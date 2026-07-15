import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface LeakageFinding {
  path: string;
  token: string;
}

const bannedTokens = ['paperclip', 'openclaw', 'litellm', 'openbao', 'k3s', 'gvisor', 'runsc'];

const scannedRoots = ['site', 'monitor.config.json'];

export function findLeakage(path: string, content: string): LeakageFinding[] {
  const lower = content.toLowerCase();
  return bannedTokens.filter((token) => lower.includes(token)).map((token) => ({ path, token }));
}

async function collectFiles(path: string): Promise<string[]> {
  const info = await stat(path);
  if (!info.isDirectory()) {
    return [path];
  }
  const entries = await readdir(path);
  const nested = await Promise.all(entries.map((entry) => collectFiles(join(path, entry))));
  return nested.flat();
}

async function main(): Promise<void> {
  const files = (await Promise.all(scannedRoots.map(collectFiles))).flat();
  const findings = [];
  for (const file of files) {
    findings.push(...findLeakage(file, await readFile(file, 'utf8')));
  }
  if (findings.length > 0) {
    throw new Error(
      `Public status leakage guard failed: ${findings.map((f) => `${f.path}:${f.token}`).join(', ')}`,
    );
  }
  console.log('Public status leakage guard passed');
}

if (process.argv[1]?.endsWith('leakage-guard.ts')) {
  await main();
}
