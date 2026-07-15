import { describe, expect, it } from 'vitest';
import type { PrivateProbeConfig } from '../scripts/lib/config.js';
import {
  evaluatePrivateHttpStatus,
  summarizePrivateProbeResults,
} from '../scripts/lib/private-monitor-core.js';

const probe: PrivateProbeConfig = {
  id: 'app-login',
  urlEnv: 'PROBE_URL_PRIVATE_APP_LOGIN',
  mode: 'http-status',
  expectedStatus: 200,
};

describe('private monitor pure logic', () => {
  it('accepts the expected HTTP status without exposing the URL', () => {
    expect(evaluatePrivateHttpStatus(probe, 200)).toEqual({
      id: 'app-login',
      ok: true,
      detail: 'ok',
    });
  });

  it('summarizes failing private probes by id only', () => {
    const result = evaluatePrivateHttpStatus(probe, 503);
    expect(result).toEqual({ id: 'app-login', ok: false, detail: 'expected 200, got 503' });
    expect(summarizePrivateProbeResults([result])).toBe('Private probes failed: app-login');
  });
});
