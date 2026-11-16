import mongoose from 'mongoose';
import { z } from 'zod';
import { Analysis } from '../../database/models/Analysis.js';
import { Dependency } from '../../database/models/Dependency.js';
import { Endpoint } from '../../database/models/Endpoint.js';
import { GitHubInstallation } from '../../database/models/GitHubInstallation.js';
import { Repository } from '../../database/models/Repository.js';
import { TestEndpointMapping } from '../../database/models/TestEndpointMapping.js';
import { HttpError } from '../../shared/HttpError.js';
import { compareRepositoryCommits } from '../github/githubApp.service.js';

const comparisonSchema = z.object({
  baseAnalysisId: z.string().regex(/^[a-f\d]{24}$/i),
  headAnalysisId: z.string().regex(/^[a-f\d]{24}$/i),
});

function endpointKey(endpoint) {
  return `${endpoint.method} ${endpoint.path}`;
}

function reachableFiles(changedPaths, dependencies) {
  const dependents = new Map();
  for (const edge of dependencies) {
    const list = dependents.get(edge.toPath) || [];
    list.push({ path: edge.fromPath, confidence: edge.confidence || 'medium' });
    dependents.set(edge.toPath, list);
  }
  const reached = new Set(changedPaths);
  const quality = new Map([...changedPaths].map((path) => [path, 'high']));
  const queue = [...changedPaths];
  while (queue.length && reached.size <= 5000) {
    const path = queue.shift();
    for (const dependent of dependents.get(path) || []) {
      const ranks = { high: 2, medium: 1, low: 0 };
      const confidence = ranks[quality.get(path)] <= ranks[dependent.confidence] ? quality.get(path) : dependent.confidence;
      if (!quality.has(dependent.path) || ranks[confidence] > ranks[quality.get(dependent.path)]) {
        reached.add(dependent.path); quality.set(dependent.path, confidence); queue.push(dependent.path);
      }
    }
  }
  return { paths: reached, confidenceByPath: quality };
}

function makeConfidence(values, partial) {
  if (partial || values.includes('low')) return 'low';
  if (values.includes('medium')) return 'medium';
  return 'high';
}

export async function compareRepositoryImpact(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'REPOSITORY_NOT_FOUND', 'The connected repository was not found.');
  const repository = await Repository.findOne({ _id: id, ownerUserId: req.session.userId, status: 'connected' }).lean();
  if (!repository) throw new HttpError(404, 'REPOSITORY_NOT_FOUND', 'The connected repository was not found.');
  const installation = await GitHubInstallation.findOne({ installationId: repository.installationId, ownerUserId: req.session.userId, status: 'active' }).lean();
  if (!installation) throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'The GitHub App installation is no longer active.');

  const { baseAnalysisId, headAnalysisId } = comparisonSchema.parse(req.body);
  if (baseAnalysisId === headAnalysisId) throw new HttpError(400, 'ANALYSIS_COMPARISON_INVALID', 'Choose two different repository analyses.');
  const ownerUserId = req.session.userId;
  const [base, head] = await Promise.all([
    Analysis.findOne({ _id: baseAnalysisId, repositoryId: repository._id, ownerUserId, status: { $in: ['completed', 'partial'] } }).lean(),
    Analysis.findOne({ _id: headAnalysisId, repositoryId: repository._id, ownerUserId, status: { $in: ['completed', 'partial'] } }).lean(),
  ]);
  if (!base || !head) throw new HttpError(404, 'ANALYSIS_NOT_FOUND', 'One or both commit analyses were not found for this repository.');
  if (base.commitSha === head.commitSha) throw new HttpError(400, 'ANALYSIS_COMPARISON_INVALID', 'The selected analyses point to the same commit.');

  const [comparison, baseDependencies, headDependencies, baseEndpoints, headEndpoints, baseMappings, headMappings] = await Promise.all([
    compareRepositoryCommits(repository.installationId, repository.ownerLogin, repository.name, base.commitSha, head.commitSha),
    Dependency.find({ analysisId: base._id, repositoryId: repository._id, ownerUserId }).lean(),
    Dependency.find({ analysisId: head._id, repositoryId: repository._id, ownerUserId }).lean(),
    Endpoint.find({ analysisId: base._id, repositoryId: repository._id, ownerUserId }).lean(),
    Endpoint.find({ analysisId: head._id, repositoryId: repository._id, ownerUserId }).lean(),
    TestEndpointMapping.find({ analysisId: base._id, repositoryId: repository._id, ownerUserId }).lean(),
    TestEndpointMapping.find({ analysisId: head._id, repositoryId: repository._id, ownerUserId }).lean(),
  ]);

  if (comparison.baseSha !== base.commitSha || comparison.headSha !== head.commitSha) {
    throw new HttpError(409, 'ANALYSIS_COMMIT_MISMATCH', 'GitHub resolved a different commit range. Refresh repository analyses and try again.');
  }
  const dependencies = [...baseDependencies, ...headDependencies];
  const changedPaths = new Set(comparison.files.flatMap((file) => [file.path, file.previousPath].filter(Boolean)));
  const reached = reachableFiles(changedPaths, dependencies);
  const reachedByChange = new Map([...changedPaths].map((path) => [path, reachableFiles([path], dependencies)]));
  const changedTests = new Set(comparison.files.filter((file) => /(?:^|\/)(?:__tests__\/|tests?\/)|\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(file.path)).map((file) => file.path));
  const baseByKey = new Map(baseEndpoints.map((endpoint) => [endpointKey(endpoint), endpoint]));
  const headByKey = new Map(headEndpoints.map((endpoint) => [endpointKey(endpoint), endpoint]));
  const affected = new Map();
  for (const endpoint of [...baseEndpoints, ...headEndpoints]) {
    const endpointFiles = [endpoint.routeFile, ...(endpoint.controllerFiles || [])];
    const pathEvidence = [...changedPaths].filter((path) => endpointFiles.some((file) => reachedByChange.get(path)?.paths.has(file)));
    const reachedEndpoint = endpointFiles.some((path) => reached.paths.has(path));
    const mappedTestChanged = [...baseMappings, ...headMappings].some((mapping) =>
      String(mapping.endpointId) === String(endpoint._id) && changedTests.has(mapping.testFilePath));
    if (reachedEndpoint || mappedTestChanged) {
      const key = endpointKey(endpoint);
      const old = affected.get(key) || { key, method: endpoint.method, path: endpoint.path, base: baseByKey.get(key), head: headByKey.get(key), files: new Set(), confidence: [] };
      pathEvidence.forEach((path) => {
        old.files.add(path);
        const targetFile = endpointFiles.find((file) => reachedByChange.get(path)?.paths.has(file));
        if (targetFile) old.confidence.push(reachedByChange.get(path).confidenceByPath.get(targetFile));
      });
      if (endpoint.confidence) old.confidence.push(endpoint.confidence);
      affected.set(key, old);
    }
  }
  const relevantMappings = [...baseMappings, ...headMappings].filter((mapping) => {
    const endpoint = [...baseEndpoints, ...headEndpoints].find((item) => String(item._id) === String(mapping.endpointId));
    return endpoint && affected.has(endpointKey(endpoint));
  });
  const testMap = new Map();
  for (const path of changedTests) testMap.set(path, { path, reason: 'Changed test file', confidence: 'high' });
  for (const mapping of relevantMappings) {
    const current = testMap.get(mapping.testFilePath);
    if (!current) testMap.set(mapping.testFilePath, { path: mapping.testFilePath, reason: 'Maps to an affected endpoint', confidence: mapping.confidence });
    else if (mapping.confidence === 'low') current.confidence = 'low';
  }
  const partial = base.status === 'partial' || head.status === 'partial' || comparison.truncated;
  const tests = [...testMap.values()].map((test) => ({ ...test, confidence: partial ? 'low' : test.confidence }));
  const endpoints = [...affected.values()].map((item) => ({
    method: item.method,
    path: item.path,
    state: !item.head ? 'removed' : !item.base ? 'added' : 'affected',
    files: [...item.files],
    tests: [...new Set(relevantMappings.filter((mapping) => {
      const endpoint = [...baseEndpoints, ...headEndpoints].find((value) => String(value._id) === String(mapping.endpointId));
      return endpoint && endpointKey(endpoint) === item.key;
    }).map((mapping) => mapping.testFilePath))],
    confidence: makeConfidence(item.confidence, partial),
  }));
  const unmappedRuntimeChanges = comparison.files.filter((file) =>
    /\.(?:[cm]?[jt]sx?)$/i.test(file.path) && !changedTests.has(file.path)
      && !endpoints.some((endpoint) => endpoint.files.includes(file.path) || endpoint.files.includes(file.previousPath)));
  const warnings = [];
  if (partial) warnings.push('One or both source analyses or the GitHub file comparison were bounded; impact mappings may be incomplete.');
  if (tests.length === 0) warnings.push('No tests were statically mapped to the affected files. Run the full test suite rather than skipping tests.');
  if (endpoints.some((endpoint) => endpoint.confidence === 'low')) warnings.push('At least one affected endpoint has a low-confidence source mapping. Run the full test suite.');
  if (endpoints.some((endpoint) => endpoint.tests.length === 0)) warnings.push('At least one affected endpoint has no statically mapped test. Run the full test suite.');
  if (tests.some((test) => test.confidence === 'low')) warnings.push('At least one related test mapping has low confidence. Run the full test suite.');
  if (unmappedRuntimeChanges.length) warnings.push(`${unmappedRuntimeChanges.length} changed source file(s) could not be traced to an endpoint. Run the full test suite.`);
  const fullSuiteRecommended = tests.length === 0 || partial || unmappedRuntimeChanges.length > 0 || endpoints.some((endpoint) => endpoint.confidence === 'low' || endpoint.tests.length === 0) || tests.some((test) => test.confidence === 'low');

  return res.json({ data: { impact: {
    repository: { id: String(repository._id), fullName: repository.fullName },
    base: { analysisId: String(base._id), commitSha: base.commitSha, commitRef: base.commitRef },
    head: { analysisId: String(head._id), commitSha: head.commitSha, commitRef: head.commitRef },
    mergeBaseSha: comparison.mergeBaseSha,
    aheadBy: comparison.aheadBy,
    behindBy: comparison.behindBy,
    changedFiles: comparison.files,
    endpoints,
    tests,
    summary: { changedFiles: comparison.files.length, affectedEndpoints: endpoints.length, relatedTests: tests.length, confidence: endpoints.length && !unmappedRuntimeChanges.length ? makeConfidence(endpoints.map((endpoint) => endpoint.confidence), partial) : 'low', fullSuiteRecommended },
    warnings,
  } } });
}
