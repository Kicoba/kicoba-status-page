import { describe, expect, it } from 'vitest';
import {
  apiStatusToProbeResults,
  planMonitorActions,
  unreachableApiStatus,
} from '../scripts/lib/monitor-core.js';

const now = new Date('2026-07-12T10:00:00.000Z');

describe('monitor pure logic', () => {
  it('maps API status JSON into separate public components', () => {
    expect(apiStatusToProbeResults({ api: 'operational', agentExecution: 'degraded' })).toEqual([
      { component: 'api', status: 'operational' },
      { component: 'agent-execution', status: 'degraded' },
    ]);
  });

  it('marks both backend-facing components as outage when status JSON is unreachable', () => {
    expect(unreachableApiStatus()).toEqual([
      { component: 'api', status: 'outage' },
      { component: 'agent-execution', status: 'outage' },
    ]);
  });

  it('creates one incident when no duplicate open issue exists', () => {
    expect(planMonitorActions([{ component: 'dashboard', status: 'outage' }], [], now)).toEqual([
      {
        type: 'create',
        component: 'dashboard',
        severity: 'outage',
        title: '[Incident] Service disruption detected on Dashboard',
        body: 'The monitoring system detected a outage status on Dashboard at 2026-07-12T10:00:00.000Z.',
        labels: ['component:dashboard', 'severity:outage'],
      },
    ]);
  });

  it('does not create duplicates and closes existing incidents on recovery', () => {
    const openIncidents = [{ id: 42, components: ['api' as const] }];
    expect(
      planMonitorActions([{ component: 'api', status: 'outage' }], openIncidents, now),
    ).toEqual([{ type: 'none', component: 'api' }]);
    expect(
      planMonitorActions([{ component: 'api', status: 'operational' }], openIncidents, now),
    ).toEqual([
      {
        type: 'close',
        issueId: 42,
        component: 'api',
        comment: 'Service is operational again. Automatically resolved by the monitoring system.',
      },
    ]);
  });
});
