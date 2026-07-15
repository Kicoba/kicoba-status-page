import type { PrivateProbeConfig } from './config.js';

export interface PrivateProbeResult {
  id: string;
  ok: boolean;
  detail: string;
}

export function summarizePrivateProbeResults(results: readonly PrivateProbeResult[]): string {
  const failed = results.filter((result) => !result.ok).map((result) => result.id);
  return failed.length === 0
    ? 'All private probes passed'
    : `Private probes failed: ${failed.join(', ')}`;
}

export function evaluatePrivateHttpStatus(
  probe: PrivateProbeConfig,
  actualStatus: number,
): PrivateProbeResult {
  const ok = actualStatus === probe.expectedStatus;
  return {
    id: probe.id,
    ok,
    detail: ok ? 'ok' : `expected ${probe.expectedStatus}, got ${actualStatus}`,
  };
}
