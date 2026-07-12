import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { loadConfig } from './lib/config.js';
import { buildStatusJson, overlapsWindow, type StatusIssue } from './lib/status-core.js';

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

const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
const outputPath = outputArg?.slice('--output='.length) ?? 'site/status.json';

async function main(): Promise<void> {
  const generatedAt = new Date();
  const config = await loadConfig();
  const issues = (await fetchIssues()).filter((issue) => overlapsWindow(issue, generatedAt, 90));
  const status = buildStatusJson(issues, generatedAt, config.components, {
    warn: (message) => console.warn(message),
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(status, null, 2)}\n`);
}

async function fetchIssues(): Promise<StatusIssue[]> {
  const token = requiredEnv('GITHUB_TOKEN');
  const repo = requiredEnv('GITHUB_REPOSITORY');
  const all: StatusIssue[] = [];
  for (let page = 1; ; page += 1) {
    const url = `https://api.github.com/repos/${repo}/issues?state=all&per_page=100&page=${page}`;
    const response = await fetch(url, { headers: githubHeaders(token) });
    if (!response.ok) {
      throw new Error(`GitHub issues fetch failed with ${response.status}`);
    }
    const items = (await response.json()) as GitHubIssue[];
    if (items.length === 0) {
      break;
    }
    all.push(...items.filter((item) => !item.pull_request).map(toStatusIssue));
  }
  return all;
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
