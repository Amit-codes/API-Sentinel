import mongoose from 'mongoose';
import { z } from 'zod';
import { Analysis } from '../../database/models/Analysis.js';
import { ExecutionRun } from '../../database/models/ExecutionRun.js';
import { GitHubInstallation } from '../../database/models/GitHubInstallation.js';
import { Repository } from '../../database/models/Repository.js';
import { HttpError } from '../../shared/HttpError.js';
import { dispatchSentinelWorkflow, getSentinelWorkflowRun } from '../github/githubApp.service.js';

const startSchema = z.object({ baseAnalysisId: z.string().regex(/^[a-f\d]{24}$/i), headAnalysisId: z.string().regex(/^[a-f\d]{24}$/i) });

async function ownedRepository(id, userId) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'REPOSITORY_NOT_FOUND', 'The connected repository was not found.');
  const repository = await Repository.findOne({ _id: id, ownerUserId: userId, status: 'connected' }).lean();
  if (!repository) throw new HttpError(404, 'REPOSITORY_NOT_FOUND', 'The connected repository was not found.');
  const installation = await GitHubInstallation.findOne({ installationId: repository.installationId, ownerUserId: userId, status: 'active' }).lean();
  if (!installation) throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'The GitHub App installation is no longer active.');
  return repository;
}

function shape(run) {
  return { id: String(run._id), repositoryId: String(run.repositoryId), baseAnalysisId: String(run.baseAnalysisId), headAnalysisId: String(run.headAnalysisId), commitSha: run.commitSha, commitRef: run.commitRef, selection: run.selection, testFramework: run.testFramework, status: run.status, conclusion: run.conclusion, workflowUrl: run.workflowUrl, startedAt: run.startedAt, completedAt: run.completedAt, createdAt: run.createdAt };
}

export async function startExecutionRun(req, res) {
  const repository = await ownedRepository(req.params.id, req.session.userId);
  const { baseAnalysisId, headAnalysisId } = startSchema.parse(req.body);
  if (baseAnalysisId === headAnalysisId) throw new HttpError(400, 'ANALYSIS_COMPARISON_INVALID', 'Choose two different repository analyses.');
  const [base, head] = await Promise.all([
    Analysis.findOne({ _id: baseAnalysisId, repositoryId: repository._id, ownerUserId: req.session.userId, status: { $in: ['completed', 'partial'] } }).lean(),
    Analysis.findOne({ _id: headAnalysisId, repositoryId: repository._id, ownerUserId: req.session.userId, status: { $in: ['completed', 'partial'] } }).lean(),
  ]);
  if (!base || !head) throw new HttpError(404, 'ANALYSIS_NOT_FOUND', 'One or both commit analyses were not found for this repository.');
  if (base.commitSha === head.commitSha) throw new HttpError(400, 'ANALYSIS_COMPARISON_INVALID', 'The selected analyses point to the same commit.');
  const framework = head.project?.testFramework || (head.project?.vitestDetected ? 'vitest' : head.project?.jestDetected ? 'jest' : null);
  if (!framework) throw new HttpError(400, 'TEST_FRAMEWORK_NOT_DETECTED', 'Phase 5 supports Jest or Vitest projects. Add one as a dependency, then analyze this commit again.');
  if (head.project?.jestDetected && head.project?.vitestDetected && !head.project?.testFramework) throw new HttpError(400, 'TEST_FRAMEWORK_AMBIGUOUS', 'Both Jest and Vitest were detected. Set the package.json test script to the framework you want to run, then analyze this commit again.');
  if (head.project?.packageManager !== 'npm') throw new HttpError(400, 'NPM_LOCKFILE_REQUIRED', 'The Phase 5 workflow currently requires package-lock.json or npm-shrinkwrap.json.');

  const run = await ExecutionRun.create({ repositoryId: repository._id, ownerUserId: req.session.userId, baseAnalysisId: base._id, headAnalysisId: head._id, commitSha: head.commitSha, commitRef: head.commitRef, testFramework: framework, configSnapshot: { runtime: 'node20', installCommand: 'npm ci', testCommand: framework === 'vitest' ? 'npx --no-install vitest run' : 'npx --no-install jest --runInBand' } });
  try {
    await dispatchSentinelWorkflow(repository.installationId, repository.ownerLogin, repository.name, repository.defaultBranch, run._id, head.commitSha, framework, head.project?.packageDirectory || '.');
    run.status = 'queued';
    await run.save();
    return res.status(202).json({ data: { run: shape(run) } });
  } catch (error) {
    run.status = 'dispatch_failed';
    run.errorCode = error.code || 'WORKFLOW_DISPATCH_FAILED';
    await run.save();
    throw error;
  }
}

export async function listExecutionRuns(req, res) {
  const repository = await ownedRepository(req.params.id, req.session.userId);
  const runs = await ExecutionRun.find({ repositoryId: repository._id, ownerUserId: req.session.userId }).sort({ createdAt: -1 }).limit(50).lean();
  return res.json({ data: { runs: runs.map(shape) } });
}

export async function refreshExecutionRun(req, res) {
  const repository = await ownedRepository(req.params.id, req.session.userId);
  if (!mongoose.isValidObjectId(req.params.runId)) throw new HttpError(404, 'RUN_NOT_FOUND', 'The execution run was not found.');
  const run = await ExecutionRun.findOne({ _id: req.params.runId, repositoryId: repository._id, ownerUserId: req.session.userId });
  if (!run) throw new HttpError(404, 'RUN_NOT_FOUND', 'The execution run was not found.');
  if (['queued', 'in_progress'].includes(run.status)) {
    const remote = await getSentinelWorkflowRun(repository.installationId, repository.ownerLogin, repository.name, run._id);
    if (remote) {
      run.workflowRunId = remote.id; run.workflowUrl = remote.htmlUrl; run.startedAt = remote.startedAt ? new Date(remote.startedAt) : null;
      if (remote.status === 'completed') {
        run.status = remote.conclusion === 'success' ? 'completed' : remote.conclusion === 'cancelled' ? 'cancelled' : 'failed';
        run.conclusion = remote.conclusion; run.completedAt = remote.completedAt ? new Date(remote.completedAt) : new Date();
      } else run.status = remote.status === 'in_progress' ? 'in_progress' : 'queued';
      await run.save();
    }
  }
  return res.json({ data: { run: shape(run) } });
}
