import { readFile } from 'node:fs/promises';
import {
  apiStatusToProbeResults,
  type MonitorAction,
  type MonitorTarget,
  type ProbeResult,
  planMonitorActions,
  unreachableApiStatus,
} from './lib/monitor-core.js';
import { type ComponentId, parseIssue, type StatusIssue } from './lib/status-core.js';

interface GitHubIssueLabel {
  name?: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  labels: GitHubIssueLabel[];
  state: 'open' | 'closed';
  // biome-ignore lint/style/useNamingConvention: GitHub REST API uses snake_case fields.
  created_at: string;
  // biome-ignore lint/style/useNamingConvention: GitHub REST API uses snake_case fields.
  closed_at: string | null;
  // biome-ignore lint/style/useNamingConvention: GitHub REST API uses snake_case fields.
  html_url: string;
  // biome-ignore lint/style/useNamingConvention: GitHub REST API uses snake_case fields.
  pull_request?: unknown;
}

async function main(): Promise<void> {
  const config = JSON.parse(await readFile('monitor.config.json', 'utf8')) as MonitorTarget[];
  const [results, openIncidents] = await Promise.all([runProbes(config), fetchOpenIncidents()]);
  const actions = planMonitorActions(results, openIncidents, new Date());
  for (const action of actions) {
    await executeAction(action);
  }
}

async function runProbes(targets: readonly MonitorTarget[]): Promise<ProbeResult[]> {
  const groups = await Promise.all(targets.map(runProbe));
  return groups.flat();
}

async function runProbe(target: MonitorTarget): Promise<ProbeResult[]> {
  const url = requiredEnv(target.urlEnv);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (target.mode === 'http-200') {
      return [
        { component: target.component, status: response.status === 200 ? 'operational' : 'outage' },
      ];
    }
    if (!response.ok) {
      return unreachableApiStatus();
    }
    return apiStatusToProbeResults(
      (await response.json()) as {
        api: 'operational' | 'degraded' | 'outage';
        agentExecution: 'operational' | 'degraded' | 'outage';
      },
    );
  } catch {
    return target.mode === 'api-status-json'
      ? unreachableApiStatus()
      : [{ component: target.component, status: 'outage' }];
  }
}

async function fetchOpenIncidents(): Promise<{ id: number; components: ComponentId[] }[]> {
  const token = requiredEnv('GITHUB_TOKEN');
  const repo = requiredEnv('GITHUB_REPOSITORY');
  const response = await fetch(
    `https://api.github.com/repos/${repo}/issues?state=open&per_page=100`,
    {
      headers: githubHeaders(token),
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub open issues fetch failed with ${response.status}`);
  }
  const issues = (await response.json()) as GitHubIssue[];
  return issues
    .filter((issue) => !issue.pull_request)
    .map(toStatusIssue)
    .map((issue) => parseIssue(issue))
    .filter((issue): issue is NonNullable<typeof issue> => issue !== null)
    .map((issue) => ({ id: issue.id, components: issue.components }));
}

async function executeAction(action: MonitorAction): Promise<void> {
  if (action.type === 'none') {
    return;
  }
  const token = requiredEnv('GITHUB_TOKEN');
  const repo = requiredEnv('GITHUB_REPOSITORY');
  if (action.type === 'create') {
    await githubRequest(`https://api.github.com/repos/${repo}/issues`, token, {
      method: 'POST',
      body: JSON.stringify({ title: action.title, body: action.body, labels: action.labels }),
    });
    return;
  }
  await githubRequest(
    `https://api.github.com/repos/${repo}/issues/${action.issueId}/comments`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ body: action.comment }),
    },
  );
  await githubRequest(`https://api.github.com/repos/${repo}/issues/${action.issueId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'closed' }),
  });
}

async function githubRequest(url: string, token: string, init: RequestInit): Promise<void> {
  const response = await fetch(url, {
    ...init,
    headers: { ...githubHeaders(token), 'content-type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`GitHub write failed with ${response.status}`);
  }
}

function toStatusIssue(issue: GitHubIssue): StatusIssue {
  return {
    id: issue.number,
    title: issue.title,
    body: issue.body ?? '',
    labels: issue.labels.map((label) => label.name ?? '').filter(Boolean),
    state: issue.state,
    openedAt: issue.created_at,
    closedAt: issue.closed_at,
    url: issue.html_url,
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function githubHeaders(token: string): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': '2022-11-28',
  };
}

await main();
