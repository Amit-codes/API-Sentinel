import { createSign } from 'node:crypto';
import { env } from '../../config/env.js';
import { HttpError } from '../../shared/HttpError.js';

const apiOrigin = 'https://api.github.com';
const accessTokenCache = new Map();

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createAppJwt() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  return `${unsigned}.${signer.sign(env.githubAppPrivateKey).toString('base64url')}`;
}

async function githubRequest(path, { token, appJwt, method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${apiOrigin}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'API-Sentinel',
        Authorization: `Bearer ${token || appJwt}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new HttpError(502, 'GITHUB_UNAVAILABLE', 'GitHub could not be reached. Please try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404 && path.includes('/actions/workflows/')) throw new HttpError(404, 'SENTINEL_WORKFLOW_NOT_FOUND', 'Add .github/workflows/api-sentinel.yml to the repository default branch, then try again.');
    if (response.status === 404) throw new HttpError(404, 'GITHUB_RESOURCE_NOT_FOUND', 'The GitHub resource was not found or is no longer accessible.');
    if ((response.status === 401 || response.status === 403) && path.includes('/actions/workflows/')) throw new HttpError(502, 'GITHUB_ACTIONS_PERMISSION_REQUIRED', 'GitHub Actions access is unavailable. Confirm the workflow exists on the default branch and the GitHub App installation has Actions read and write permission.');
    if (response.status === 401 || response.status === 403) throw new HttpError(502, 'GITHUB_APP_AUTH_FAILED', 'GitHub App access could not be verified. Check the App configuration and permissions.');
    throw new HttpError(502, 'GITHUB_REQUEST_FAILED', 'GitHub could not complete the request. Please try again.');
  }
  return { data, headers: response.headers };
}

export async function getInstallationDetails(installationId) {
  const { data } = await githubRequest(`/app/installations/${encodeURIComponent(installationId)}`, { appJwt: createAppJwt() });
  return data;
}

export async function getInstallationToken(installationId) {
  const key = String(installationId);
  const cached = accessTokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const { data } = await githubRequest(`/app/installations/${encodeURIComponent(key)}/access_tokens`, { appJwt: createAppJwt(), method: 'POST', body: {} });
  const expiresAt = Date.parse(data.expires_at);
  if (!data.token || !Number.isFinite(expiresAt)) throw new HttpError(502, 'GITHUB_APP_AUTH_FAILED', 'GitHub returned an invalid installation token.');
  accessTokenCache.set(key, { token: data.token, expiresAt });
  return data.token;
}

async function listPages(path, token) {
  const results = [];
  for (let page = 1; page <= 100; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const { data } = await githubRequest(`${path}${separator}per_page=100&page=${page}`, { token });
    const items = Array.isArray(data.repositories) ? data.repositories : (Array.isArray(data) ? data : []);
    results.push(...items);
    if (items.length < 100) return results;
  }
  return results;
}

export async function listInstallationRepositories(installationId) {
  const token = await getInstallationToken(installationId);
  return listPages('/installation/repositories', token);
}

export async function getInstallationRepository(installationId, repositoryId) {
  const token = await getInstallationToken(installationId);
  const { data } = await githubRequest(`/repositories/${encodeURIComponent(repositoryId)}`, { token });
  return data;
}

export async function listRepositoryBranches(installationId, owner, repository) {
  const token = await getInstallationToken(installationId);
  return listPages(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/branches`, token);
}

export async function getRepositoryAnalysisSnapshot(installationId, owner, repository, ref) {
  const token = await getInstallationToken(installationId);
  const safeOwner = encodeURIComponent(owner);
  const safeRepository = encodeURIComponent(repository);
  const commitResult = await githubRequest(`/repos/${safeOwner}/${safeRepository}/commits/${encodeURIComponent(ref)}`, { token });
  const commit = commitResult.data;
  if (!commit.sha || !commit.commit?.tree?.sha) throw new HttpError(502, 'GITHUB_COMMIT_INVALID', 'GitHub returned incomplete commit details.');
  const treeResult = await githubRequest(`/repos/${safeOwner}/${safeRepository}/git/trees/${encodeURIComponent(commit.commit.tree.sha)}?recursive=1`, { token });
  const tree = treeResult.data;
  if (!Array.isArray(tree.tree)) throw new HttpError(502, 'GITHUB_TREE_INVALID', 'GitHub returned an invalid repository tree.');
  const sourceFiles = tree.tree
    .filter((entry) => entry.type === 'blob' && ['100644', '100755'].includes(entry.mode) && (/\.(?:[cm]?[jt]sx?)$/i.test(entry.path || '') || /(?:^|\/)package\.json$/i.test(entry.path || '')))
    .sort((left, right) => Number(right.path === 'package.json') - Number(left.path === 'package.json') || left.path.localeCompare(right.path));
  const selected = [];
  let selectedBytes = 0;
  for (const entry of sourceFiles) {
    if (selected.length >= 400 || selectedBytes + (entry.size || 0) > 8 * 1024 * 1024) break;
    if ((entry.size || 0) > 512 * 1024) continue;
    selected.push(entry);
    selectedBytes += entry.size || 0;
  }
  const contents = new Map();
  let cursor = 0;
  async function worker() {
    while (cursor < selected.length) {
      const entry = selected[cursor++];
      const { data } = await githubRequest(`/repos/${safeOwner}/${safeRepository}/git/blobs/${encodeURIComponent(entry.sha)}`, { token });
      if (data.encoding !== 'base64' || typeof data.content !== 'string') continue;
      const text = Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf8');
      contents.set(entry.path, { text, sha: entry.sha, size: entry.size || Buffer.byteLength(text) });
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, selected.length) }, worker));
  return {
    commitSha: commit.sha,
    ref,
    treeSha: commit.commit.tree.sha,
    files: contents,
    treePaths: tree.tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path),
    sourceFileCount: sourceFiles.length,
    truncated: Boolean(tree.truncated || selected.length < sourceFiles.length),
  };
}

export async function compareRepositoryCommits(installationId, owner, repository, base, head) {
  const token = await getInstallationToken(installationId);
  const safeOwner = encodeURIComponent(owner);
  const safeRepository = encodeURIComponent(repository);
  const compare = `${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
  const { data } = await githubRequest(`/repos/${safeOwner}/${safeRepository}/compare/${compare}`, { token });
  if (!Array.isArray(data.files) || !data.base_commit?.sha || !data.merge_base_commit?.sha) {
    throw new HttpError(502, 'GITHUB_COMPARE_INVALID', 'GitHub returned incomplete commit comparison details.');
  }
  return {
    baseSha: data.base_commit.sha,
    headSha: head,
    mergeBaseSha: data.merge_base_commit.sha,
    aheadBy: data.ahead_by,
    behindBy: data.behind_by,
    files: data.files.map((file) => ({ path: file.filename, previousPath: file.previous_filename || null, status: file.status, additions: file.additions, deletions: file.deletions, changes: file.changes })),
    truncated: data.files.length >= 300,
  };
}

export async function dispatchSentinelWorkflow(installationId, owner, repository, branch, runId, commitSha, testFramework = 'jest', workingDirectory = '.') {
  const token = await getInstallationToken(installationId);
  await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/actions/workflows/api-sentinel.yml/dispatches`, {
    token,
    method: 'POST',
    body: { ref: branch, inputs: { sentinelRunId: String(runId), commitSha, testFramework, workingDirectory } },
  });
}

export async function getSentinelWorkflowRun(installationId, owner, repository, runId) {
  const token = await getInstallationToken(installationId);
  const { data } = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/actions/workflows/api-sentinel.yml/runs?event=workflow_dispatch&per_page=100`, { token });
  const match = (data.workflow_runs || []).find((run) => run.display_title === `API Sentinel Run #${runId}` || run.name === `API Sentinel Run #${runId}`);
  if (!match) return null;
  return { id: String(match.id), status: match.status, conclusion: match.conclusion, htmlUrl: match.html_url, startedAt: match.run_started_at || match.created_at, completedAt: match.updated_at };
}

export function summarizeGitHubRepository(repo) {
  return {
    githubId: String(repo.id),
    fullName: repo.full_name,
    ownerLogin: repo.owner?.login,
    name: repo.name,
    isPrivate: Boolean(repo.private),
    defaultBranch: repo.default_branch,
  };
}
