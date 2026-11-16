import { randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { GitHubInstallation } from '../../database/models/GitHubInstallation.js';
import { Repository } from '../../database/models/Repository.js';
import { HttpError } from '../../shared/HttpError.js';
import { getInstallationDetails, getInstallationRepository, listInstallationRepositories, listRepositoryBranches, summarizeGitHubRepository } from './githubApp.service.js';
import { appSetupQuerySchema, branchSchema, installationParamSchema, repositoryParamsSchema, selectRepositorySchema } from './github.validation.js';

function publicInstallation(installation) {
  return { id: installation.installationId, accountLogin: installation.accountLogin, accountType: installation.accountType, repositorySelection: installation.repositorySelection, status: installation.status };
}

function publicRepository(repository) {
  return {
    id: String(repository._id), githubId: repository.githubId, installationId: repository.installationId,
    fullName: repository.fullName, ownerLogin: repository.ownerLogin, name: repository.name,
    isPrivate: repository.isPrivate, defaultBranch: repository.defaultBranch, selectedBranch: repository.selectedBranch,
    status: repository.status, lastCommitSha: repository.lastCommitSha, lastPushAt: repository.lastPushAt,
  };
}

export function startAppInstallation(req, res, next) {
  const state = randomBytes(32).toString('hex');
  req.session.githubAppInstallState = state;
  req.session.save((error) => {
    if (error) return next(error);
    const url = new URL(`https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`);
    url.searchParams.set('state', state);
    return res.redirect(url.toString());
  });
}

export async function finishAppInstallation(req, res, next) {
  try {
    const { installation_id: installationId, state } = appSetupQuerySchema.parse(req.query);
    const expectedState = req.session.githubAppInstallState;
    delete req.session.githubAppInstallState;
    if (typeof expectedState !== 'string' || state.length !== expectedState.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))) {
      throw new HttpError(400, 'GITHUB_INSTALL_STATE_INVALID', 'The GitHub App installation request expired. Start it again from API Sentinel.');
    }
    const detail = await getInstallationDetails(installationId);
    const accountId = detail.account?.id;
    const accountLogin = detail.account?.login;
    if (!accountId || !accountLogin) throw new HttpError(502, 'GITHUB_APP_INSTALLATION_INVALID', 'GitHub returned incomplete installation details.');
    const existing = await GitHubInstallation.findOne({ installationId }).select('ownerUserId').lean();
    if (existing?.ownerUserId && String(existing.ownerUserId) !== String(req.session.userId)) {
      throw new HttpError(409, 'INSTALLATION_ALREADY_LINKED', 'This GitHub App installation is already linked to another API Sentinel account.');
    }
    const installationUpdate = { $set: {
        ownerUserId: req.session.userId,
        accountId: String(accountId),
        accountLogin,
        accountType: detail.target_type || detail.account?.type || null,
        repositorySelection: detail.repository_selection === 'all' ? 'all' : 'selected',
        status: 'active',
        suspendedAt: null,
    } };
    try {
      await GitHubInstallation.findOneAndUpdate(
        { installationId, $or: [{ ownerUserId: req.session.userId }, { ownerUserId: null }] },
        installationUpdate,
        { new: true, upsert: true, runValidators: true },
      );
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const linkedOwner = await GitHubInstallation.findOne({ installationId }).select('ownerUserId').lean();
      if (linkedOwner?.ownerUserId && String(linkedOwner.ownerUserId) !== String(req.session.userId)) {
        throw new HttpError(409, 'INSTALLATION_ALREADY_LINKED', 'This GitHub App installation is already linked to another API Sentinel account.');
      }
      throw error;
    }
    return res.redirect(`${env.WEB_ORIGIN}/?github=connected`);
  } catch (error) {
    if (error instanceof HttpError && error.status < 500) return res.redirect(`${env.WEB_ORIGIN}/?github=error`);
    return next(error);
  }
}

export async function listInstallations(req, res) {
  const installations = await GitHubInstallation.find({ ownerUserId: req.session.userId, status: 'active' }).sort({ accountLogin: 1 }).lean();
  res.json({ data: { installations: installations.map(publicInstallation) } });
}

export async function listAvailableRepositories(req, res) {
  const { installationId } = installationParamSchema.parse(req.params);
  const installation = await GitHubInstallation.findOne({ installationId, ownerUserId: req.session.userId, status: 'active' });
  if (!installation) throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'The GitHub App installation is not connected to this account.');
  const repositories = await listInstallationRepositories(installationId);
  res.json({ data: { repositories: repositories.map(summarizeGitHubRepository) } });
}

export async function listConnectedRepositories(req, res) {
  const repositories = await Repository.find({ ownerUserId: req.session.userId, status: 'connected' }).sort({ fullName: 1 }).lean();
  res.json({ data: { repositories: repositories.map(publicRepository) } });
}

export async function connectRepository(req, res) {
  const input = selectRepositorySchema.parse(req.body);
  const installation = await GitHubInstallation.findOne({ installationId: input.installationId, ownerUserId: req.session.userId, status: 'active' });
  if (!installation) throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'The GitHub App installation is not connected to this account.');
  const remote = await getInstallationRepository(input.installationId, input.repositoryId);
  if (!remote.full_name || !remote.owner?.login || !remote.default_branch) throw new HttpError(502, 'GITHUB_REPOSITORY_INVALID', 'GitHub returned incomplete repository details.');
  const branches = await listRepositoryBranches(input.installationId, remote.owner.login, remote.name);
  if (!branches.some((branch) => branch.name === input.branch)) throw new HttpError(400, 'BRANCH_NOT_FOUND', 'Choose a branch that exists in this repository.');
  const summary = summarizeGitHubRepository(remote);
  const repository = await Repository.findOneAndUpdate(
    { githubId: summary.githubId },
    { $set: {
      ownerUserId: req.session.userId, installationId: input.installationId, fullName: summary.fullName,
      ownerLogin: summary.ownerLogin, name: summary.name, isPrivate: summary.isPrivate,
      defaultBranch: summary.defaultBranch, selectedBranch: input.branch, status: 'connected',
    } },
    { new: true, upsert: true, runValidators: true },
  );
  res.status(201).json({ data: { repository: publicRepository(repository) } });
}

async function findOwnedRepository(req) {
  const { id } = repositoryParamsSchema.parse(req.params);
  const repository = await Repository.findOne({ _id: id, ownerUserId: req.session.userId, status: 'connected' });
  if (!repository) throw new HttpError(404, 'REPOSITORY_NOT_FOUND', 'The connected repository was not found.');
  const installation = await GitHubInstallation.findOne({ installationId: repository.installationId, ownerUserId: req.session.userId, status: 'active' });
  if (!installation) throw new HttpError(404, 'INSTALLATION_NOT_FOUND', 'The GitHub App installation is no longer active.');
  return { repository, installation };
}

export async function listConnectedBranches(req, res) {
  const { repository } = await findOwnedRepository(req);
  const branches = await listRepositoryBranches(repository.installationId, repository.ownerLogin, repository.name);
  res.json({ data: { branches: branches.map((branch) => ({ name: branch.name, protected: Boolean(branch.protected) })) } });
}

export async function updateSelectedBranch(req, res) {
  const { branch } = branchSchema.parse(req.body);
  const { repository } = await findOwnedRepository(req);
  const branches = await listRepositoryBranches(repository.installationId, repository.ownerLogin, repository.name);
  if (!branches.some((item) => item.name === branch)) throw new HttpError(400, 'BRANCH_NOT_FOUND', 'Choose a branch that exists in this repository.');
  repository.selectedBranch = branch;
  await repository.save();
  res.json({ data: { repository: publicRepository(repository) } });
}

export async function disconnectRepository(req, res) {
  const { id } = repositoryParamsSchema.parse(req.params);
  const repository = await Repository.findOneAndUpdate(
    { _id: id, ownerUserId: req.session.userId, status: 'connected' },
    { $set: { status: 'disconnected' } },
    { new: true },
  );
  if (!repository) throw new HttpError(404, 'REPOSITORY_NOT_FOUND', 'The connected repository was not found.');
  res.status(204).end();
}

