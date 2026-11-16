import { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, Bookmark, Check, ChevronDown,
  CircleAlert, CircleHelp, FileText, GitBranch, GitFork, Github, LayoutDashboard,
  LogOut, Moon, Play, RefreshCw, Settings, Shield, ShieldCheck, Sparkles, Sun,
  Workflow,
} from 'lucide-react';
import { api, API_BASE_URL } from './lib/api.js';

const pages = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, phase: 3 },
  { id: 'repositories', label: 'Repositories', icon: GitFork, phase: 3 },
  { id: 'impact', label: 'Impact Analysis', icon: GitBranch, phase: 4 },
  { id: 'test-runs', label: 'Test Runs', icon: Play, phase: 5 },
  { id: 'regressions', label: 'Regressions', icon: AlertTriangle, phase: 6 },
  { id: 'failures', label: 'Failure Insights', icon: CircleAlert, phase: 7 },
  { id: 'reports', label: 'Reports', icon: FileText, phase: 7 },
  { id: 'baselines', label: 'Baselines', icon: Bookmark, phase: 6 },
  { id: 'settings', label: 'Settings', icon: Settings, phase: null },
];

function Brand() {
  return <div className="brand"><span className="brand-mark"><ShieldCheck size={21} strokeWidth={2.3} /></span><span className="brand-name">API Sentinel</span></div>;
}

function ThemeToggle({ theme, onToggle, compact = false }) {
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  const Icon = nextTheme === 'dark' ? Moon : Sun;
  return <button className={`theme-toggle ${compact ? 'theme-toggle-compact' : ''}`} onClick={onToggle} aria-label={`Switch to ${nextTheme} mode`} title={`Switch to ${nextTheme} mode`}><Icon size={16} /><span>{compact ? '' : `${nextTheme[0].toUpperCase()}${nextTheme.slice(1)} mode`}</span></button>;
}

function PageHeader({ page, theme, onToggleTheme, action }) {
  const current = pages.find((item) => item.id === page) || pages[0];
  const descriptions = {
    overview: 'Your connected repositories and latest analysis at a glance.',
    repositories: 'Connected GitHub repositories, monitored branches and source analysis.',
    impact: 'Changed files, affected endpoints and the evidence behind each mapping.',
    'test-runs': 'Execution history, selected tests and run configuration.',
    regressions: 'Behavior differences against approved API baselines.',
    failures: 'Related failures grouped to make investigation easier.',
    reports: 'Evidence-backed summaries for repository analyses and test runs.',
    baselines: 'Approved response baselines and their version history.',
    settings: 'Account, appearance and workspace preferences.',
  };
  return <header className="page-header"><div><div className="page-eyebrow">API SENTINEL <span>/</span> WORKSPACE</div><h1>{current.label}</h1><p>{descriptions[page] || descriptions.overview}</p></div><div className="page-header-actions">{action}<ThemeToggle theme={theme} onToggle={onToggleTheme} compact /></div></header>;
}

function SignIn({ error, theme, onToggleTheme }) {
  return <main className="login-page" data-theme={theme}><nav className="login-nav"><Brand /><div className="login-nav-actions"><ThemeToggle theme={theme} onToggle={onToggleTheme} /><a className="nav-link" href="https://github.com" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={14} /></a></div></nav><section className="login-content"><div className="login-copy"><div className="login-eyebrow"><span className="pulse-dot" /> INTELLIGENT API REGRESSION TESTING</div><h1>Ship changes.<br /><span>Know what broke.</span></h1><p className="login-lead">API Sentinel maps code changes to the endpoints and tests they can affect, so your team can focus on the signal.</p><div className="benefit-list"><div><span className="benefit-icon"><GitBranch size={17} /></span><span><b>Understand impact</b><small>Connect source changes to API endpoints.</small></span></div><div><span className="benefit-icon"><Workflow size={17} /></span><span><b>Run the right tests</b><small>Spend less time waiting for feedback.</small></span></div><div><span className="benefit-icon"><Shield size={17} /></span><span><b>Catch behavior changes</b><small>Compare results against approved baselines.</small></span></div></div></div><div className="auth-card"><div className="auth-card-top"><span className="github-avatar"><Github size={23} /></span><span className="secure-pill"><i /> Secure sign in</span></div><h2>Welcome to Sentinel</h2><p>Sign in with GitHub to get started with your API quality workspace.</p>{error && <div className="alert" role="alert">{error}</div>}<a className="github-button" href={`${API_BASE_URL}/api/v1/auth/github`}><Github size={18} /> Continue with GitHub <ArrowUpRight size={15} /></a><div className="auth-divider"><span /><small>YOUR ACCOUNT, YOUR REPOSITORIES</small><span /></div><div className="trust-row"><ShieldCheck size={15} /> Access is limited to repositories you authorize.</div></div></section><footer className="login-footer"><span>© 2026 API Sentinel</span><span>Built for confident releases <Sparkles size={13} /></span></footer></main>;
}

function MetricCard({ label, value, note, icon: Icon, tone = '' }) {
  return <article className="metric-card"><div className="metric-label">{label}<Icon size={17} className="metric-icon" /></div><strong className={`metric-value ${tone}`}>{value}</strong><span className="metric-note">{note}</span></article>;
}

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`status-pill status-${tone}`}><i />{children}</span>;
}

function AnalysisPanel({ repository }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const refresh = useCallback(() => {
    let active = true;
    setLoading(true);
    api.latestAnalysis(repository.id).then(({ analysis: result }) => { if (active) setAnalysis(result); })
      .catch((err) => { if (active) { setAnalysis(null); if (!err.message.includes('has not been analyzed')) setError(err.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repository.id]);
  useEffect(() => refresh(), [refresh]);
  async function analyze() {
    setRunning(true); setError('');
    try { const { analysis: result } = await api.analyzeRepository(repository.id); setAnalysis(result); setExpanded(true); }
    catch (err) { setError(err.message); }
    finally { setRunning(false); }
  }
  return <section className="panel analysis-panel"><div className="panel-heading"><div><div className="panel-kicker"><Sparkles size={14} /> REPOSITORY ANALYSIS</div><h2>{analysis ? `Commit ${analysis.commitSha.slice(0, 8)}` : 'Source discovery'}</h2><p>{analysis ? `Selected branch ${analysis.commitRef} · ${analysis.status} analysis` : 'Inspect the selected branch at its latest commit.'}</p></div><button className="button button-primary" onClick={analyze} disabled={running || loading}><Sparkles size={15} />{running ? 'Analyzing…' : analysis ? 'Analyze latest commit' : 'Analyze repository'}</button></div>
    {error && <div className="inline-alert" role="alert">{error}</div>}
    {loading && <div className="loading-row"><span className="spinner" /> Loading saved analysis…</div>}
    {!loading && !analysis && !error && <div className="empty-inline"><ShieldCheck size={18} /><span>No analysis yet. Run an analysis to discover endpoints, source relationships and tests.</span></div>}
    {analysis && <><div className="analysis-metrics">{[['Discovered endpoints', analysis.summary.endpoints], ['Source files', analysis.summary.sourceFiles], ['Test files', analysis.summary.testFiles], ['Source relationships', analysis.summary.dependencies]].map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div><button className="link-button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Hide details' : 'View analysis details'} <ChevronDown size={15} className={expanded ? 'rotate-icon' : ''} /></button>
      {expanded && <div className="analysis-details"><div className="analysis-meta"><div className="section-heading"><div><h3>Project inspection</h3><p>{analysis.project.name || 'Node.js project'}</p></div><StatusPill tone={analysis.status === 'completed' ? 'success' : 'warning'}>{analysis.status}</StatusPill></div><div className="fact-grid"><span>Package manager <b>{analysis.project.packageManager}</b></span><span>Package directory <b>{analysis.project.packageDirectory || '.'}</b></span><span>Jest <b>{analysis.project.jestDetected ? 'Detected' : 'Not detected'}</b></span><span>Vitest <b>{analysis.project.vitestDetected ? 'Detected' : 'Not detected'}</b></span><span>Supertest <b>{analysis.project.supertestDetected ? 'Detected' : 'Not detected'}</b></span><span>Entry points <b>{analysis.project.entryPoints.join(', ') || 'Not identified'}</b></span><span>Test framework <b>{analysis.project.testFramework || 'Not identified'}</b></span><span>Test config <b>{[...(analysis.project.jestConfigFiles || []), ...(analysis.project.vitestConfigFiles || [])].join(', ') || 'Not identified'}</b></span></div>{Object.keys(analysis.project.scripts || {}).length > 0 && <div className="script-list"><h4>Package scripts</h4>{Object.entries(analysis.project.scripts).slice(0, 20).map(([name, command]) => <div key={name}><code>{name}</code><code>{command}</code></div>)}</div>}</div>
        <div className="section-heading analysis-subheading"><div><h3>Discovered endpoints</h3><p>{analysis.summary.unmappedEndpoints} without a statically matched test</p></div><span>{analysis.endpoints.length}</span></div>
        {analysis.endpoints.length ? <div className="endpoint-list">{analysis.endpoints.map((endpoint) => <article className="endpoint-row" key={endpoint.id}><div className="endpoint-main"><span className={`method-tag method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><code>{endpoint.path}</code><StatusPill tone={endpoint.confidence === 'high' ? 'success' : endpoint.confidence === 'medium' ? 'warning' : 'danger'}>{endpoint.confidence} confidence</StatusPill></div><p>{endpoint.routeFile}:{endpoint.line || '?'}{endpoint.controllerFiles.length ? ` · ${endpoint.controllerFiles.join(', ')}` : ''}</p>{endpoint.middlewareNames.length > 0 && <p>Middleware: {endpoint.middlewareNames.join(', ')}</p>}{endpoint.tests.length > 0 && <p>Matched tests: {endpoint.tests.map((test) => test.file).join(', ')}</p>}{endpoint.unsupportedReasons.map((reason) => <p className="warning-copy" key={reason}>{reason}</p>)}</article>)}</div> : <div className="empty-inline">No statically identifiable Express routes were found.</div>}
        <div className="analysis-columns"><section><div className="section-heading"><div><h3>Source relationships</h3><p>Static import and call evidence</p></div><span>{analysis.dependencies.length}</span></div>{analysis.dependencies.length ? <ul className="relationship-list">{analysis.dependencies.slice(0, 80).map((edge, index) => <li key={`${edge.from}-${edge.to}-${edge.type}-${index}`}><code>{edge.from}</code><span>{edge.type.replaceAll('_', ' ')}</span><code>{edge.to}</code></li>)}</ul> : <p className="muted-copy">No local source relationships were identified.</p>}</section><section><div className="section-heading"><div><h3>Discovered tests</h3><p>Static Jest and Supertest discovery</p></div><span>{analysis.testFiles.length}</span></div>{analysis.testFiles.length ? <ul className="test-list">{analysis.testFiles.map((test) => <li key={test.path}><b>{test.path}</b><span>{test.framework}{test.hasSupertest ? ' · Supertest' : ''} · {test.cases.length} cases</span>{test.suites.slice(0, 4).map((suite) => <small key={suite}>{suite}</small>)}{test.cases.slice(0, 8).map((testCase) => <small key={testCase}>↳ {testCase}</small>)}{test.requests.slice(0, 8).map((request, index) => <small key={`${request.method}-${request.path}-${index}`}>{request.method} {request.path}</small>)}</li>)}</ul> : <p className="muted-copy">No Jest test files were identified.</p>}</section></div>
        {analysis.warnings.length > 0 && <div className="warning-panel"><b>Coverage notes</b><ul>{analysis.warnings.slice(0, 20).map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}<div className="commit-footnote">Exact analyzed commit <code>{analysis.commitSha}</code><span>· {analysis.commitRef}</span></div>
      </div>}
    </>}
  </section>;
}

function RepositoryManager() {
  const [installations, setInstallations] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [available, setAvailable] = useState({});
  const [expanded, setExpanded] = useState({});
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyInstallation, setBusyInstallation] = useState('');
  const [busyRepository, setBusyRepository] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [installationResult, repositoryResult] = await Promise.all([api.installations(), api.repositories()]);
      setInstallations(installationResult.installations); setRepositories(repositoryResult.repositories);
      setSelectedId((current) => repositoryResult.repositories.some((repo) => repo.id === current) ? current : repositoryResult.repositories[0]?.id || '');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  function installApp() { window.location.assign(`${API_BASE_URL}/api/v1/github/app/install`); }
  async function browse(installationId) {
    if (expanded[installationId]) { setExpanded((value) => ({ ...value, [installationId]: false })); return; }
    setExpanded((value) => ({ ...value, [installationId]: true }));
    if (available[installationId]) return;
    setBusyInstallation(installationId); setError('');
    try { const result = await api.availableRepositories(installationId); setAvailable((value) => ({ ...value, [installationId]: result.repositories })); }
    catch (err) { setError(err.message); }
    finally { setBusyInstallation(''); }
  }
  async function connect(installationId, repository) {
    setBusyRepository(repository.githubId); setError(''); setMessage('');
    try { await api.connectRepository({ installationId, repositoryId: repository.githubId, branch: repository.defaultBranch }); setMessage(`${repository.fullName} connected on ${repository.defaultBranch}.`); await refresh(); }
    catch (err) { setError(err.message); }
    finally { setBusyRepository(''); }
  }
  async function disconnect(repository) {
    if (!window.confirm(`Disconnect ${repository.fullName}? It will stop receiving push updates.`)) return;
    setError(''); setMessage('');
    try { await api.disconnectRepository(repository.id); setMessage(`${repository.fullName} disconnected.`); await refresh(); }
    catch (err) { setError(err.message); }
  }
  async function setBranch(repository, branch) {
    try { await api.setBranch(repository.id, branch); setRepositories((items) => items.map((item) => item.id === repository.id ? { ...item, selectedBranch: branch } : item)); }
    catch (err) { setError(err.message); }
  }
  const selectedRepository = repositories.find((repository) => repository.id === selectedId);
  return <div className="page-stack">
    {error && <div className="inline-alert" role="alert"><span>{error}</span><button onClick={() => setError('')}>Dismiss</button></div>}{message && <div className="inline-success" role="status"><Check size={16} />{message}<button onClick={() => setMessage('')}>Dismiss</button></div>}
    <section className="panel app-connection"><div className="section-heading"><div><h2>GitHub App connection</h2><p>Repository access remains scoped to the GitHub installation you authorize.</p></div><button className="button button-primary" onClick={installApp}><Github size={16} />Connect repository</button></div>
      {loading ? <div className="loading-row"><span className="spinner" />Loading GitHub connections…</div> : installations.length === 0 ? <div className="empty-inline"><Github size={18} /><span>No GitHub App installation is linked yet.</span><button className="button button-secondary" onClick={installApp}>Install GitHub App <ArrowUpRight size={14} /></button></div> : <div className="installation-list">{installations.map((installation) => <article className="installation-row" key={installation.id}><div className="installation-avatar">{installation.accountLogin.slice(0, 1).toUpperCase()}</div><div className="installation-copy"><b>{installation.accountLogin}</b><span>{installation.accountType || 'GitHub account'} · {installation.repositorySelection === 'all' ? 'All repositories authorized' : 'Selected repositories authorized'}</span></div><StatusPill tone="success">Active</StatusPill><button className="button button-secondary button-small" onClick={() => browse(installation.id)} disabled={busyInstallation === installation.id}>{busyInstallation === installation.id ? 'Loading…' : expanded[installation.id] ? 'Hide repositories' : 'Browse repositories'}</button>
        {expanded[installation.id] && <div className="available-repos">{available[installation.id] ? available[installation.id].length ? available[installation.id].map((repository) => { const connected = repositories.some((item) => item.githubId === repository.githubId); return <div className="available-repo-row" key={repository.githubId}><div><b>{repository.fullName}</b><span>{repository.isPrivate ? 'Private' : 'Public'} · default {repository.defaultBranch}</span></div>{connected ? <StatusPill tone="success">Connected</StatusPill> : <button className="button button-secondary button-small" onClick={() => connect(installation.id, repository)} disabled={busyRepository === repository.githubId}>{busyRepository === repository.githubId ? 'Connecting…' : 'Connect'}</button>}</div>; }) : <p className="muted-copy">No repositories are available for this installation.</p> : <p className="muted-copy">Loading authorized repositories…</p>}</div>}
      </article>)}</div>}
    </section>
    <section className="panel"><div className="section-heading"><div><h2>Connected repositories <span className="count-pill">{repositories.length}</span></h2><p>Choose a repository to set its branch and view source analysis.</p></div><button className="icon-button" onClick={refresh} disabled={loading} aria-label="Refresh repositories"><RefreshCw size={15} /></button></div>
      {loading ? <div className="loading-row"><span className="spinner" />Loading connected repositories…</div> : repositories.length === 0 ? <div className="empty-panel"><Github size={22} /><b>No repositories connected</b><p>Browse the repositories authorized for your GitHub App installation to connect one.</p></div> : <div className="table-wrap"><table><thead><tr><th>Repository</th><th>Branch</th><th>Visibility</th><th>Status</th><th>Latest push</th><th /></tr></thead><tbody>{repositories.map((repository) => <tr key={repository.id} className={repository.id === selectedId ? 'selected-row' : ''}><td><button className="repo-select" onClick={() => setSelectedId(repository.id)}><Github size={16} /><b>{repository.fullName}</b></button></td><td><code>{repository.selectedBranch}</code></td><td>{repository.isPrivate ? 'Private' : 'Public'}</td><td><StatusPill tone="success">Connected</StatusPill></td><td>{repository.lastPushAt ? new Date(repository.lastPushAt).toLocaleString() : 'No push yet'}</td><td><button className="text-button danger-text" onClick={() => disconnect(repository)}>Disconnect</button></td></tr>)}</tbody></table></div>}
    </section>
    {selectedRepository && <RepositoryDetail key={selectedRepository.id} repository={selectedRepository} onSetBranch={setBranch} />}
  </div>;
}

function RepositoryDetail({ repository, onSetBranch }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; api.branches(repository.id).then(({ branches: items }) => { if (active) setBranches(items); }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [repository.id]);
  return <section className="panel repository-settings"><div className="section-heading"><div><h2>{repository.fullName}</h2><p>Repository settings and the saved source analysis.</p></div><StatusPill tone="success">Connected</StatusPill></div><div className="repo-controls"><label><span><GitBranch size={15} /> Monitored branch</span><select value={repository.selectedBranch} onChange={(event) => onSetBranch(repository, event.target.value)} disabled={loading || branches.length === 0}>{loading ? <option>Loading branches…</option> : branches.map((branch) => <option key={branch.name} value={branch.name}>{branch.name}{branch.protected ? ' · protected' : ''}</option>)}</select></label><div><span>Default branch</span><code>{repository.defaultBranch}</code></div><div><span>Latest pushed commit</span><code>{repository.lastCommitSha ? repository.lastCommitSha.slice(0, 8) : 'None received'}</code></div></div>{error && <div className="inline-alert" role="alert">{error}</div>}<AnalysisPanel repository={repository} /></section>;
}

function Overview({ onOpenRepositories }) {
  const [repositories, setRepositories] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; api.repositories().then(({ repositories: items }) => { if (active) { setRepositories(items); setSelectedId(items[0]?.id || ''); } }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  useEffect(() => { if (!selectedId) { setAnalysis(null); return undefined; } let active = true; api.latestAnalysis(selectedId).then(({ analysis: result }) => { if (active) setAnalysis(result); }).catch(() => { if (active) setAnalysis(null); }); return () => { active = false; }; }, [selectedId]);
  const selected = repositories.find((item) => item.id === selectedId);
  return <div className="page-stack">
    {error && <div className="inline-alert" role="alert">{error}</div>}
    <section className="panel overview-summary"><div className="overview-summary-copy"><span className="panel-kicker"><Activity size={14} /> WORKSPACE STATUS</span><h2>{selected ? selected.fullName : 'Connect a repository to begin'}</h2><p>{selected ? `Monitoring ${selected.selectedBranch} · ${selected.isPrivate ? 'Private' : 'Public'} repository` : 'Connect a GitHub repository to inspect its API surface.'}</p></div><div className="overview-summary-actions">{repositories.length > 0 && <label className="repo-picker"><span>Repository</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{repositories.map((repository) => <option value={repository.id} key={repository.id}>{repository.fullName}</option>)}</select></label>}<button className="button button-primary" onClick={onOpenRepositories}>{repositories.length ? 'Manage repositories' : 'Connect repository'}<ArrowRight size={15} /></button></div></section>
    {loading ? <div className="loading-row"><span className="spinner" />Loading workspace…</div> : <>
      <div className="metric-grid"><MetricCard label="Connected repositories" value={repositories.length} note="Authorized GitHub repositories" icon={Github} /><MetricCard label="Discovered endpoints" value={analysis?.summary.endpoints ?? '—'} note={analysis ? `Latest analysis · ${analysis.commitSha.slice(0, 8)}` : 'Run a repository analysis first'} icon={GitBranch} /><MetricCard label="Discovered test files" value={analysis?.summary.testFiles ?? '—'} note={analysis?.project.testFramework ? `${analysis.project.testFramework} detected` : 'No supported test runner detected'} icon={Workflow} /><MetricCard label="Analysis status" value={analysis ? analysis.status : 'Not run'} note={analysis ? `Commit ${analysis.commitSha.slice(0, 8)} · ${analysis.commitRef}` : 'No saved analysis for this repository'} icon={ShieldCheck} tone={analysis?.status === 'partial' ? 'metric-warning' : ''} /></div>
      {repositories.length === 0 ? <div className="empty-panel large-empty"><div className="empty-symbol"><ShieldCheck size={28} /></div><h2>Your workspace is ready</h2><p>Connect a repository and run a source analysis to discover its Express endpoints, dependencies and tests.</p><button className="button button-primary" onClick={onOpenRepositories}>Connect repository <ArrowRight size={15} /></button></div> : <div className="overview-grid"><section className="panel"><div className="section-heading"><div><h2>Repository activity</h2><p>Latest push recorded by the GitHub App</p></div><button className="link-button" onClick={onOpenRepositories}>View repositories <ArrowUpRight size={14} /></button></div><div className="activity-details"><span className="activity-dot" /><div><b>{selected?.lastCommitSha ? `Commit ${selected.lastCommitSha.slice(0, 8)} pushed to ${selected.selectedBranch}` : 'Waiting for a push on the selected branch'}</b><span>{selected?.lastPushAt ? new Date(selected.lastPushAt).toLocaleString() : 'No push event has been received for this branch yet.'}</span></div></div>{analysis && <div className="activity-details analysis-activity"><span className="activity-dot violet" /><div><b>{analysis.summary.endpoints} endpoint{analysis.summary.endpoints === 1 ? '' : 's'} discovered</b><span>Source inspection completed for commit {analysis.commitSha.slice(0, 8)}.</span></div><StatusPill tone={analysis.status === 'completed' ? 'success' : 'warning'}>{analysis.status}</StatusPill></div>}</section><section className="panel next-step-panel"><span className="panel-kicker"><Sparkles size={14} /> NEXT STEP</span><h2>{analysis ? 'Review your source map' : 'Analyze your repository'}</h2><p>{analysis ? 'Inspect the discovered endpoints, relationships and test mappings on the repository page.' : 'Run Phase 3 analysis to identify Express routes and discover test files in the selected repository.'}</p><button className="button button-secondary" onClick={onOpenRepositories}>{analysis ? 'Open analysis' : 'Open repositories'} <ArrowRight size={14} /></button></section></div>}
      <footer className="page-footnote"><span>API Sentinel</span><span>Repository discovery is available in Phase 3. Test execution and regression results require later phases.</span></footer>
    </>}
  </div>;
}

function ImpactPage() {
  const [repositories, setRepositories] = useState([]);
  const [repositoryId, setRepositoryId] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const [baseId, setBaseId] = useState('');
  const [headId, setHeadId] = useState('');
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [startingRun, setStartingRun] = useState(false);
  const [runNotice, setRunNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.repositories().then(({ repositories: items }) => {
      if (!active) return;
      setRepositories(items);
      setRepositoryId(items[0]?.id || '');
    }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setAnalyses([]); setImpact(null); setBaseId(''); setHeadId('');
    if (!repositoryId) return undefined;
    api.analyses(repositoryId).then(({ analyses: items }) => {
      if (!active) return;
      setAnalyses(items);
      setHeadId(items[0]?.id || '');
      setBaseId(items[1]?.id || '');
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [repositoryId]);

  async function compare() {
    setComparing(true); setError(''); setImpact(null);
    try { const result = await api.compareImpact(repositoryId, baseId, headId); setImpact(result.impact); }
    catch (err) { setError(err.message); }
    finally { setComparing(false); }
  }
  async function startRun() {
    setStartingRun(true); setError(''); setRunNotice('');
    try { const { run } = await api.startRun(repositoryId, baseId, headId); setRunNotice(`Full-suite run queued for ${run.commitSha.slice(0, 8)}. Open Test Runs to follow its status.`); }
    catch (err) { setError(err.message); }
    finally { setStartingRun(false); }
  }
  const base = analyses.find((item) => item.id === baseId);
  const head = analyses.find((item) => item.id === headId);
  return <div className="page-stack impact-page">
    {error && <div className="inline-alert" role="alert">{error}</div>}
    {runNotice && <div className="inline-success">{runNotice}</div>}
    <section className="panel impact-controls"><div className="section-heading"><div><h2>Compare analyzed commits</h2><p>Impact uses persisted Phase 3 source maps and GitHub’s exact commit comparison.</p></div><StatusPill tone="success">Phase 4 active</StatusPill></div>
      {loading ? <div className="loading-row"><span className="spinner" />Loading connected repositories…</div> : repositories.length === 0 ? <div className="empty-inline"><Github size={18} /><span>Connect a repository and analyze at least two commits to map change impact.</span></div> : <div className="impact-form">
        <label><span>Repository</span><select value={repositoryId} onChange={(event) => setRepositoryId(event.target.value)}>{repositories.map((repo) => <option key={repo.id} value={repo.id}>{repo.fullName}</option>)}</select></label>
        <label><span>Base commit</span><select value={baseId} onChange={(event) => setBaseId(event.target.value)} disabled={analyses.length < 2}>{analyses.map((item) => <option key={item.id} value={item.id}>{item.commitSha.slice(0, 8)} · {item.commitRef}</option>)}</select></label>
        <label><span>Head commit</span><select value={headId} onChange={(event) => setHeadId(event.target.value)} disabled={!analyses.length}>{analyses.map((item) => <option key={item.id} value={item.id}>{item.commitSha.slice(0, 8)} · {item.commitRef}</option>)}</select></label>
        <button className="button button-primary" onClick={compare} disabled={comparing || analyses.length < 2 || !baseId || !headId || baseId === headId}>{comparing ? 'Mapping impact…' : 'Compare commits'} <ArrowRight size={15} /></button>
      </div>}
      {!loading && repositories.length > 0 && analyses.length < 2 && <div className="empty-inline impact-hint"><CircleHelp size={17} /><span>Two different commits need saved analyses. Analyze the current branch, then analyze again after a new commit is pushed or select another branch with a different commit.</span></div>}
      {base && head && <p className="muted-copy impact-range">Comparing <code>{base.commitSha}</code> to <code>{head.commitSha}</code>.</p>}
    </section>
    {impact && <>
      <section className="panel impact-summary"><div><span>Changed files</span><strong>{impact.summary.changedFiles}</strong></div><div><span>Affected endpoints</span><strong>{impact.summary.affectedEndpoints}</strong></div><div><span>Related tests</span><strong>{impact.summary.relatedTests}</strong></div><div><span>Mapping confidence</span><StatusPill tone={impact.summary.confidence === 'high' ? 'success' : impact.summary.confidence === 'medium' ? 'warning' : 'danger'}>{impact.summary.confidence}</StatusPill></div></section>
      <section className="panel"><div className="section-heading"><div><h2>Run this commit</h2><p>Phase 5 runs the complete {head?.project?.testFramework || 'Jest or Vitest'} suite at the exact head commit on a temporary GitHub-hosted runner.</p></div><button className="button button-primary" onClick={startRun} disabled={startingRun || !head?.project?.testFramework || head?.project?.packageManager !== 'npm'}>{startingRun ? 'Queueing run…' : `Run full ${head?.project?.testFramework || 'test'} suite`} <ArrowRight size={15} /></button></div>{head && !head.project?.testFramework && <p className="muted-copy">Jest or Vitest was not detected in this saved analysis. Add one as a dependency, set the package.json test script if both are installed, then analyze this commit again.</p>}{head?.project?.testFramework && head.project.packageManager !== 'npm' && <p className="muted-copy">This workflow currently requires an npm lockfile. Add package-lock.json and analyze this commit again.</p>}</section>
      {impact.warnings.map((warning) => <div className="inline-alert" key={warning}><CircleAlert size={16} />{warning}</div>)}
      <section className="panel"><div className="section-heading"><div><h2>Changed files</h2><p>GitHub reports {impact.aheadBy} commits ahead of the merge base.</p></div></div>{impact.changedFiles.length ? <div className="table-wrap"><table><thead><tr><th>File</th><th>Change</th><th>Lines</th></tr></thead><tbody>{impact.changedFiles.map((file) => <tr key={`${file.status}:${file.path}`}><td><code>{file.previousPath ? `${file.previousPath} → ` : ''}{file.path}</code></td><td><StatusPill tone={file.status === 'removed' ? 'danger' : file.status === 'added' ? 'success' : 'warning'}>{file.status}</StatusPill></td><td><span className="diff-add">+{file.additions}</span> / <span className="diff-remove">−{file.deletions}</span></td></tr>)}</tbody></table></div> : <div className="empty-inline">No changed files in this commit range.</div>}</section>
      <div className="planned-grid"><section className="panel"><div className="section-heading"><div><h2>Affected endpoints</h2><p>Reached through changed route, controller or dependency files.</p></div></div>{impact.endpoints.length ? <div className="impact-result-list">{impact.endpoints.map((endpoint) => <article className="impact-result" key={`${endpoint.method} ${endpoint.path}`}><div className="endpoint-main"><span className={`method-tag method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><code>{endpoint.path}</code><StatusPill tone={endpoint.state === 'removed' ? 'danger' : endpoint.state === 'added' ? 'success' : 'warning'}>{endpoint.state}</StatusPill></div><p>Evidence: {endpoint.files.length ? endpoint.files.join(', ') : 'changed mapped test'} · {endpoint.confidence} confidence</p><p>Related tests: {endpoint.tests.length ? endpoint.tests.join(', ') : 'No static mapping found'}</p></article>)}</div> : <div className="empty-inline"><GitBranch size={17} /><span>No discovered endpoint was reached from the changed files and dependency graph.</span></div>}</section>
        <section className="panel"><div className="section-heading"><div><h2>Related tests</h2><p>Candidate tests linked to changed files or affected endpoints. No tests are run in Phase 4.</p></div></div>{impact.tests.length ? <div className="impact-result-list">{impact.tests.map((test) => <article className="impact-result test-impact" key={test.path}><code>{test.path}</code><p>{test.reason}</p><StatusPill tone={test.confidence === 'high' ? 'success' : test.confidence === 'medium' ? 'warning' : 'danger'}>{test.confidence} confidence</StatusPill></article>)}</div> : <div className="empty-inline"><CircleHelp size={17} /><span>No tests were identified as directly related. Run the full suite to avoid skipping coverage.</span></div>}{impact.summary.fullSuiteRecommended && <div className="inline-alert full-suite-note"><AlertTriangle size={15} />Full test suite recommended because impact evidence is incomplete or no tests were mapped.</div>}</section></div>
    </>}
  </div>;
}

const upcoming = {
  'test-runs': { phase: 5, title: 'Test execution', text: 'Runs execute on temporary GitHub-hosted runners at the exact analyzed commit. API Sentinel credentials are never sent to repository code.' },
  regressions: { phase: 6, title: 'Regression detection is planned', text: 'Phase 6 will compare observed API behavior against developer-approved, versioned baselines.' },
  failures: { phase: 7, title: 'Failure grouping is planned', text: 'Phase 7 will classify execution failures and group related evidence without treating every failed test as a regression.' },
  reports: { phase: 7, title: 'Evidence reports are planned', text: 'Reports will summarize real commit, impact, execution and regression evidence as those capabilities are implemented.' },
  baselines: { phase: 6, title: 'Approved baselines are planned', text: 'Phase 6 will add baseline creation, approval and version history. No sample baselines are shown as real data.' },
};

function TestRunsPage() {
  const [repositories, setRepositories] = useState([]);
  const [repositoryId, setRepositoryId] = useState('');
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { api.repositories().then(({ repositories: items }) => { setRepositories(items); setRepositoryId(items[0]?.id || ''); }).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  const loadRuns = useCallback(async () => { if (!repositoryId) { setRuns([]); return; } try { const { runs: items } = await api.runs(repositoryId); setRuns(items); setError(''); } catch (e) { setError(e.message); } }, [repositoryId]);
  useEffect(() => { loadRuns(); }, [loadRuns]);
  useEffect(() => { if (!runs.some((run) => ['queued', 'in_progress'].includes(run.status))) return undefined; const timer = window.setInterval(async () => { setRefreshing(true); try { await Promise.all(runs.filter((run) => ['queued', 'in_progress'].includes(run.status)).map((run) => api.refreshRun(repositoryId, run.id))); await loadRuns(); } finally { setRefreshing(false); } }, 12000); return () => window.clearInterval(timer); }, [runs, repositoryId, loadRuns]);
  async function refreshAll() { setRefreshing(true); try { await Promise.all(runs.filter((run) => ['queued', 'in_progress'].includes(run.status)).map((run) => api.refreshRun(repositoryId, run.id))); await loadRuns(); } finally { setRefreshing(false); } }
  const tone = (status) => ['completed'].includes(status) ? 'success' : ['failed', 'dispatch_failed'].includes(status) ? 'danger' : ['queued', 'in_progress', 'dispatching'].includes(status) ? 'warning' : 'neutral';
  return <div className="page-stack"><section className="panel"><div className="section-heading"><div><h2>Execution history</h2><p>Full Jest or Vitest suite · exact commit checkout · ephemeral GitHub-hosted runner</p></div><button className="button button-secondary" onClick={refreshAll} disabled={refreshing || loading}><RefreshCw size={15} />{refreshing ? 'Refreshing…' : 'Refresh'}</button></div>{error && <div className="inline-alert" role="alert">{error}</div>}{loading ? <div className="loading-row"><span className="spinner" />Loading repositories…</div> : repositories.length === 0 ? <div className="empty-inline">Connect a GitHub repository to view test runs.</div> : <label className="impact-form"><span>Repository</span><select value={repositoryId} onChange={(e) => setRepositoryId(e.target.value)}>{repositories.map((repo) => <option key={repo.id} value={repo.id}>{repo.fullName}</option>)}</select></label>}{runs.length > 0 && <div className="table-wrap"><table><thead><tr><th>Commit</th><th>Selection</th><th>Created</th><th>Result</th><th>Workflow</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id}><td><code>{run.commitSha.slice(0, 8)}</code><small className="muted-copy"> · {run.commitRef}</small></td><td>Full {run.testFramework || 'Jest'} suite</td><td>{new Date(run.createdAt).toLocaleString()}</td><td><StatusPill tone={tone(run.status)}>{run.conclusion || run.status.replaceAll('_', ' ')}</StatusPill></td><td>{run.workflowUrl ? <a className="link-button" href={run.workflowUrl} target="_blank" rel="noreferrer">Open Actions <ArrowUpRight size={13} /></a> : '—'}</td></tr>)}</tbody></table></div>}{!loading && repositoryId && runs.length === 0 && <div className="empty-inline">No execution runs yet. Compare two analyzed commits and start a full-suite run from Impact Analysis.</div>}</section></div>;
}

function PlannedPage({ page }) {
  const details = upcoming[page];
  if (page === 'test-runs') return <TestRunsPage />;
  return <div className="page-stack"><section className="panel planned-banner"><div className="planned-icon"><Workflow size={22} /></div><div><span className="panel-kicker">PLANNED CAPABILITY · PHASE {details.phase}</span><h2>{details.title}</h2><p>{details.text}</p><StatusPill tone="neutral">Not active yet</StatusPill></div></section><div className="planned-grid"><section className="panel"><span className="panel-kicker">CURRENT INPUT</span><h3>Repository analysis</h3><p>Connect a repository and inspect a real commit from the Repositories page. That analysis is persisted and can be reviewed now.</p></section><section className="panel"><span className="panel-kicker">PHASE GATE</span><h3>Available after implementation</h3><p>This page will use saved project data when its phase is built and manually accepted. There are no illustrative run records here.</p></section></div></div>;
}

function SettingsPage({ user, onLogout, loggingOut, theme, onSetTheme }) {
  return <div className="settings-grid"><section className="panel"><div className="section-heading"><div><h2>Account</h2><p>Your authenticated GitHub identity.</p></div><Github size={18} className="panel-icon" /></div><dl className="settings-list"><div><dt>GitHub user</dt><dd>@{user.username}</dd></div><div><dt>Display name</dt><dd>{user.displayName || 'Not provided'}</dd></div><div><dt>Repository access</dt><dd>Only repositories authorized for API Sentinel</dd></div></dl><button className="button button-secondary" onClick={onLogout} disabled={loggingOut}><LogOut size={15} />{loggingOut ? 'Signing out…' : 'Log out'}</button></section><section className="panel"><div className="section-heading"><div><h2>Appearance</h2><p>Choose the color theme used throughout the workspace.</p></div><Sun size={18} className="panel-icon" /></div><div className="theme-options"><button className={theme === 'light' ? 'theme-option active' : 'theme-option'} onClick={() => onSetTheme('light')}><Sun size={18} /><span><b>Light</b><small>Bright canvas and white panels</small></span>{theme === 'light' && <Check size={16} />}</button><button className={theme === 'dark' ? 'theme-option active' : 'theme-option'} onClick={() => onSetTheme('dark')}><Moon size={18} /><span><b>Dark</b><small>Dim canvas and dark panels</small></span>{theme === 'dark' && <Check size={16} />}</button></div></section><section className="panel planned-setting"><div><h2>Execution policy</h2><p>Test-run policies become available with Phase 5.</p></div><StatusPill>Planned</StatusPill></section><section className="panel planned-setting"><div><h2>Notifications and usage limits</h2><p>Workspace notification preferences and usage controls will be added with execution and reporting.</p></div><StatusPill>Planned</StatusPill></section></div>;
}

function Dashboard({ user, onLogout, notice, theme, onToggleTheme, onSetTheme }) {
  const [page, setPage] = useState('overview');
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const changePage = (nextPage) => { setPage(nextPage); setLogoutError(''); };
  async function logout() {
    setLoggingOut(true); setLogoutError('');
    try { await api.logout(); await onLogout(); }
    catch (error) { setLogoutError(error.message); setLoggingOut(false); }
  }
  const currentPage = pages.find((item) => item.id === page) || pages[0];
  let action = null;
  if (page === 'repositories') action = <button className="button button-primary" onClick={() => window.location.assign(`${API_BASE_URL}/api/v1/github/app/install`)}><Github size={16} />Connect repository</button>;
  if (['regressions', 'failures', 'reports', 'baselines'].includes(page)) action = <button className="button button-secondary" disabled title={`Available in Phase ${upcoming[page].phase}`}>Phase {upcoming[page].phase} planned</button>;
  return <div className="app-shell" data-theme={theme}><aside className="sidebar"><Brand /><div className="sidebar-section-label">WORKSPACE</div><nav className="side-navigation" aria-label="Main navigation">{pages.map(({ id, label, icon: Icon, phase }) => <button key={id} className={`side-nav ${page === id ? 'active' : ''}`} onClick={() => changePage(id)} aria-current={page === id ? 'page' : undefined}><Icon size={19} strokeWidth={1.9} /><span>{label}</span>{phase && phase > 3 && <small>PHASE {phase}</small>}</button>)}</nav><div className="sidebar-bottom"><a className="side-nav support-link" href="https://github.com" target="_blank" rel="noreferrer"><CircleHelp size={18} /><span>GitHub support</span><ArrowUpRight size={13} /></a><div className="sidebar-profile"><span className="avatar-initial">{user.username.slice(0, 1).toUpperCase()}</span><span className="sidebar-profile-copy"><b>{user.displayName || user.username}</b><small>@{user.username} · GitHub</small></span><button className="profile-logout" onClick={logout} disabled={loggingOut} aria-label="Log out" title="Log out"><LogOut size={16} /></button></div>{logoutError && <p className="sidebar-error" role="alert">{logoutError}</p>}</div></aside><main className="main-area"><div className="content-shell"><PageHeader page={page} theme={theme} onToggleTheme={onToggleTheme} action={action} />{notice === 'connected' && <div className="inline-success notice-banner"><Check size={16} /> GitHub App installation connected. Choose repositories to add them to this workspace.</div>}{notice === 'error' && <div className="inline-alert notice-banner">The GitHub App installation could not be linked. Start the installation again from Repositories.</div>}{page === 'overview' ? <Overview onOpenRepositories={() => changePage('repositories')} /> : page === 'repositories' ? <RepositoryManager /> : page === 'impact' ? <ImpactPage /> : page === 'settings' ? <SettingsPage user={user} onLogout={logout} loggingOut={loggingOut} theme={theme} onSetTheme={onSetTheme} /> : <PlannedPage page={page} />}<footer className="workspace-footer"><span>API Sentinel <i>·</i> {currentPage.phase ? `Phase ${currentPage.phase}` : 'Workspace settings'}</span><span>Source-grounded results only</span></footer></div></main></div>;
}

export default function App() {
  const [state, setState] = useState({ status: 'loading', user: null, error: '' });
  const [githubNotice, setGithubNotice] = useState('');
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('api-sentinel-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } });
  useEffect(() => { try { localStorage.setItem('api-sentinel-theme', theme); } catch { /* theme remains available for this session */ } document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error'); const githubResult = params.get('github');
    if (oauthError || githubResult) window.history.replaceState({}, '', window.location.pathname);
    setGithubNotice(githubResult || '');
    api.currentUser().then(({ user }) => setState({ status: 'ready', user, error: '' })).catch((error) => {
      const loginError = oauthError ? 'GitHub sign-in was not completed. Please try again.' : (error.message === 'Sign in to continue.' ? '' : error.message);
      setState({ status: 'ready', user: null, error: loginError });
    });
  }, []);
  if (state.status === 'loading') return <div className="loading-screen" data-theme={theme}><div className="loading-mark"><ShieldCheck size={21} /></div><span>Preparing your workspace…</span></div>;
  if (state.user) return <Dashboard user={state.user} onLogout={() => setState({ status: 'ready', user: null, error: '' })} notice={githubNotice} theme={theme} onSetTheme={setTheme} onToggleTheme={() => setTheme((value) => value === 'light' ? 'dark' : 'light')} />;
  return <SignIn error={state.error} theme={theme} onToggleTheme={() => setTheme((value) => value === 'light' ? 'dark' : 'light')} />;
}
