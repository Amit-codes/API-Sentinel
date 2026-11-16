import mongoose from 'mongoose';
import { Analysis } from '../../database/models/Analysis.js';
import { Dependency } from '../../database/models/Dependency.js';
import { Endpoint } from '../../database/models/Endpoint.js';
import { GitHubInstallation } from '../../database/models/GitHubInstallation.js';
import { Repository } from '../../database/models/Repository.js';
import { SourceFile } from '../../database/models/SourceFile.js';
import { TestEndpointMapping } from '../../database/models/TestEndpointMapping.js';
import { TestFile } from '../../database/models/TestFile.js';
import { HttpError } from '../../shared/HttpError.js';
import { getRepositoryAnalysisSnapshot } from '../github/githubApp.service.js';
import { repositoryParamsSchema } from '../github/github.validation.js';
import { analyzeRepositoryFiles } from './repositoryAnalyzer.js';

async function findRepository(req) {
  const { id } = repositoryParamsSchema.parse(req.params);
  const repository = await Repository.findOne({ _id: id, ownerUserId: req.session.userId, status: 'connected' }).lean();
  if (!repository) throw new HttpError(404, 'REPOSITORY_NOT_FOUND', 'The connected repository was not found.');
  const installation = await GitHubInstallation.findOne({ installationId: repository.installationId, ownerUserId: req.session.userId, status: 'active' }).lean();
  if (!installation) throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'The GitHub App installation is no longer active.');
  return repository;
}

function publicAnalysis(analysis, endpoints, sourceFiles, dependencies, testFiles, mappings) {
  return {
    id: String(analysis._id), status: analysis.status, commitSha: analysis.commitSha, commitRef: analysis.commitRef,
    summary: analysis.summary, project: analysis.project, warnings: analysis.warnings,
    createdAt: analysis.createdAt, completedAt: analysis.completedAt,
    endpoints: endpoints.map((endpoint) => ({
      id: String(endpoint._id), method: endpoint.method, path: endpoint.path, routeFile: endpoint.routeFile,
      line: endpoint.line, routerName: endpoint.routerName, middlewareNames: endpoint.middlewareNames,
      handlerNames: endpoint.handlerNames, controllerFiles: endpoint.controllerFiles,
      confidence: endpoint.confidence, unsupportedReasons: endpoint.unsupportedReasons,
      tests: mappings.filter((mapping) => String(mapping.endpointId) === String(endpoint._id)).map((mapping) => ({ file: mapping.testFilePath, evidence: mapping.evidence, confidence: mapping.confidence })),
    })),
    sourceFiles: sourceFiles.map((file) => ({ path: file.path, language: file.language, kind: file.kind, symbols: file.symbols, parseDiagnostics: file.parseDiagnostics })),
    dependencies: dependencies.map((edge) => ({ from: edge.fromPath, to: edge.toPath, type: edge.relationType, symbol: edge.symbol, confidence: edge.confidence })),
    testFiles: testFiles.map((test) => ({ path: test.path, framework: test.framework, hasSupertest: test.hasSupertest, suites: test.suites, cases: test.cases, requests: test.requests, parseDiagnostics: test.parseDiagnostics })),
  };
}

async function getFullAnalysis(analysis) {
  const query = { analysisId: analysis._id };
  const [endpoints, sourceFiles, dependencies, testFiles, mappings] = await Promise.all([
    Endpoint.find(query).sort({ path: 1, method: 1 }).lean(),
    SourceFile.find(query).sort({ path: 1 }).lean(),
    Dependency.find(query).sort({ fromPath: 1, toPath: 1 }).lean(),
    TestFile.find(query).sort({ path: 1 }).lean(),
    TestEndpointMapping.find(query).lean(),
  ]);
  return publicAnalysis(analysis, endpoints, sourceFiles, dependencies, testFiles, mappings);
}

export async function createRepositoryAnalysis(req, res) {
  const repository = await findRepository(req);
  const ref = repository.selectedBranch;
  const snapshot = await getRepositoryAnalysisSnapshot(repository.installationId, repository.ownerLogin, repository.name, ref);
  const existing = await Analysis.findOne({ repositoryId: repository._id, ownerUserId: req.session.userId, commitSha: snapshot.commitSha, status: { $in: ['completed', 'partial'] } }).sort({ createdAt: -1 });
  if (existing) return res.json({ data: { analysis: await getFullAnalysis(existing) } });

  const analysis = await Analysis.create({
    repositoryId: repository._id, ownerUserId: req.session.userId,
    commitSha: snapshot.commitSha, commitRef: ref, status: 'analyzing',
  });
  try {
    const result = analyzeRepositoryFiles(snapshot.files, { sourceFileCount: snapshot.sourceFileCount, treePaths: snapshot.treePaths, truncated: snapshot.truncated });
    const scope = { analysisId: analysis._id, repositoryId: repository._id, ownerUserId: req.session.userId };
    const endpoints = await Endpoint.insertMany(result.endpoints.map((endpoint) => ({
      ...scope, method: endpoint.method, path: endpoint.path || '(dynamic)', routeFile: endpoint.routeFile,
      line: endpoint.line, routerName: endpoint.routerName, middlewareNames: endpoint.middlewareNames,
      handlerNames: endpoint.handlerNames, controllerFiles: endpoint.controllerFiles,
      confidence: endpoint.confidence, unsupportedReasons: endpoint.unsupportedReasons,
    })));
    const sourceFiles = result.sourceFiles.length ? await SourceFile.insertMany(result.sourceFiles.map((file) => ({ ...scope, ...file }))) : [];
    const dependencies = result.dependencies.length ? await Dependency.insertMany(result.dependencies.map((edge) => ({ ...scope, ...edge }))) : [];
    const testFiles = result.testFiles.length ? await TestFile.insertMany(result.testFiles.map((file) => ({ ...scope, ...file }))) : [];
    const endpointIds = new Map(endpoints.map((endpoint) => [`${endpoint.method}|${endpoint.path}|${endpoint.routeFile}|${endpoint.line}`, endpoint._id]));
    const mappings = result.mappings.flatMap((mapping) => {
      const endpointId = endpointIds.get(`${mapping.endpointMethod}|${mapping.endpointPath}|${mapping.routeFile}|${mapping.endpointLine}`);
      return endpointId ? [{ ...scope, endpointId, testFilePath: mapping.testFilePath, evidence: mapping.evidence, confidence: mapping.confidence }] : [];
    });
    const persistedMappings = mappings.length ? await TestEndpointMapping.insertMany(mappings) : [];
    analysis.project = result.project;
    analysis.summary = { ...result.summary, commitSha: snapshot.commitSha, commitRef: ref };
    analysis.warnings = result.warnings;
    analysis.status = result.warnings.length ? 'partial' : 'completed';
    analysis.completedAt = new Date();
    await analysis.save();
    return res.status(201).json({ data: { analysis: publicAnalysis(analysis.toObject(), endpoints, sourceFiles, dependencies, testFiles, persistedMappings) } });
  } catch (error) {
    analysis.status = 'failed';
    analysis.completedAt = new Date();
    analysis.warnings = ['Analysis could not be completed. Please retry after confirming repository access.'];
    await analysis.save().catch(() => {});
    throw error;
  }
}

export async function getLatestRepositoryAnalysis(req, res) {
  const repository = await findRepository(req);
  const analysis = await Analysis.findOne({ repositoryId: repository._id, ownerUserId: req.session.userId, status: { $in: ['completed', 'partial'] } }).sort({ createdAt: -1 });
  if (!analysis) throw new HttpError(404, 'ANALYSIS_NOT_FOUND', 'This repository has not been analyzed yet.');
  return res.json({ data: { analysis: await getFullAnalysis(analysis) } });
}

export async function listRepositoryAnalyses(req, res) {
  const repository = await findRepository(req);
  const analyses = await Analysis.find({ repositoryId: repository._id, ownerUserId: req.session.userId, status: { $in: ['completed', 'partial'] } })
    .sort({ createdAt: -1 }).limit(20).select('_id status commitSha commitRef summary project createdAt completedAt').lean();
  return res.json({ data: { analyses: analyses.map((analysis) => ({ id: String(analysis._id), ...analysis })) } });
}

export async function getRepositoryAnalysis(req, res) {
  const repository = await findRepository(req);
  const { analysisId } = req.params;
  if (!mongoose.isValidObjectId(analysisId)) throw new HttpError(404, 'ANALYSIS_NOT_FOUND', 'The analysis was not found.');
  const analysis = await Analysis.findOne({ _id: analysisId, repositoryId: repository._id, ownerUserId: req.session.userId });
  if (!analysis || !['completed', 'partial'].includes(analysis.status)) throw new HttpError(404, 'ANALYSIS_NOT_FOUND', 'The analysis was not found.');
  return res.json({ data: { analysis: await getFullAnalysis(analysis) } });
}
