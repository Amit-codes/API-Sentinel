const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
// Production uses the frontend origin and Vercel rewrites /api/v1 to the API host.
// That keeps the session cookie first-party, including in browsers that block third-party cookies.
const API_BASE = (import.meta.env.PROD ? '' : configuredApiBase || 'http://localhost:4000').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}/api/v1${path}`, { credentials: 'include', ...options });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || 'Something went wrong. Please try again.');
  return body.data;
}

export const api = {
  currentUser: () => request('/users/me'),
  csrf: () => request('/auth/csrf'),
  logout: async () => {
    const { csrfToken } = await request('/auth/csrf');
    return request('/auth/logout', { method: 'POST', headers: { 'x-csrf-token': csrfToken } });
  },
  installations: () => request('/github/installations'),
  availableRepositories: (installationId) => request(`/github/installations/${encodeURIComponent(installationId)}/repositories`),
  repositories: () => request('/repositories'),
  async connectRepository(input) {
    const { csrfToken } = await request('/auth/csrf');
    return request('/repositories', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) });
  },
  branches: (id) => request(`/repositories/${encodeURIComponent(id)}/branches`),
  async setBranch(id, branch) {
    const { csrfToken } = await request('/auth/csrf');
    return request(`/repositories/${encodeURIComponent(id)}/branch`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ branch }) });
  },
  async disconnectRepository(id) {
    const { csrfToken } = await request('/auth/csrf');
    return request(`/repositories/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } });
  },
  async analyzeRepository(id) {
    const { csrfToken } = await request('/auth/csrf');
    return request(`/repositories/${encodeURIComponent(id)}/analyses`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: '{}' });
  },
  latestAnalysis: (id) => request(`/repositories/${encodeURIComponent(id)}/analyses/latest`),
  analyses: (id) => request(`/repositories/${encodeURIComponent(id)}/analyses`),
  async compareImpact(id, baseAnalysisId, headAnalysisId) {
    const { csrfToken } = await request('/auth/csrf');
    return request(`/repositories/${encodeURIComponent(id)}/impact`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ baseAnalysisId, headAnalysisId }) });
  },
  async startRun(id, baseAnalysisId, headAnalysisId) {
    const { csrfToken } = await request('/auth/csrf');
    return request(`/repositories/${encodeURIComponent(id)}/runs`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ baseAnalysisId, headAnalysisId }) });
  },
  runs: (id) => request(`/repositories/${encodeURIComponent(id)}/runs`),
  async refreshRun(id, runId) {
    const { csrfToken } = await request('/auth/csrf');
    return request(`/repositories/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/refresh`, { method: 'POST', headers: { 'x-csrf-token': csrfToken } });
  },
};

export const API_BASE_URL = API_BASE;
