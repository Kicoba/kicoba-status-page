import { loadConfig, type PrivateProbeConfig } from './lib/config.js';
import {
  evaluatePrivateHttpStatus,
  summarizePrivateProbeResults,
} from './lib/private-monitor-core.js';

async function main(): Promise<void> {
  const config = await loadConfig();
  const results = [];
  for (const probe of config.privateProbes) {
    const result = await runPrivateProbe(probe);
    if (result) {
      results.push(result);
    }
  }
  if (results.length === 0) {
    console.warn(
      'No private probes ran. Configure repository secrets to enable alpha private checks.',
    );
    return;
  }
  const summary = summarizePrivateProbeResults(results);
  if (results.some((result) => !result.ok)) {
    throw new Error(summary);
  }
  console.log(summary);
}

async function runPrivateProbe(probe: PrivateProbeConfig) {
  const url = process.env[probe.urlEnv];
  if (!url) {
    console.warn(`Skipping private probe ${probe.id}: missing ${probe.urlEnv}`);
    return null;
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return evaluatePrivateHttpStatus(probe, response.status);
  } catch {
    return { id: probe.id, ok: false, detail: 'unreachable' };
  }
}

await main();
