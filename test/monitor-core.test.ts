import { describe, expect, it } from 'vitest';
import {
  apiStatusToProbeResults,
  planMonitorActions,
  unreachableApiStatus,
} from '../scripts/lib/monitor-core.js';

const now = new Date('2026-07-12T10:00:00.000Z');

const labels: Record<string, string> = {
  landing: 'Landing Page',
  dashboard: 'Dashboard',
  api: 'API',
  'agent-execution': 'Agent Execution',
};
const labelOf = (id: string): string => labels[id] ?? id;

describe('monitor pure logic', () => {
  it('maps API status JSON into components through an arbitrary key mapping', () => {
    expect(
      apiStatusToProbeResults(
        { api: 'operational', agentExecution: 'degraded' },
        { api: 'api', agentExecution: 'agent-execution' },
      ),
    ).toEqual([
      { component: 'api', status: 'operational' },
      { component: 'agent-execution', status: 'degraded' },
    ]);
  });

  it('defaults a missing payload key to outage', () => {
    expect(
      apiStatusToProbeResults({ api: 'operational' }, { api: 'api', worker: 'worker' }),
    ).toEqual([
      { component: 'api', status: 'operational' },
      { component: 'worker', status: 'outage' },
    ]);
  });

  it('marks every mapped component as outage when status JSON is unreachable', () => {
    expect(unreachableApiStatus({ api: 'api', agentExecution: 'agent-execution' })).toEqual([
      { component: 'api', status: 'outage' },
      { component: 'agent-execution', status: 'outage' },
    ]);
  });

  it('creates one incident when no duplicate open issue exists', () => {
    expect(
      planMonitorActions([{ component: 'dashboard', status: 'outage' }], [], now, labelOf),
    ).toEqual([
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
    const openIncidents = [{ id: 42, components: ['api'] }];
    expect(
      planMonitorActions([{ component: 'api', status: 'outage' }], openIncidents, now, labelOf),
    ).toEqual([{ type: 'none', component: 'api' }]);
    expect(
      planMonitorActions(
        [{ component: 'api', status: 'operational' }],
        openIncidents,
        now,
        labelOf,
      ),
    ).toEqual([
      {
        type: 'close',
        issueId: 42,
        component: 'api',
        comment: 'Service is operational again. Automatically resolved by the monitoring system.',
      },
    ]);
  });

  it('uses the id itself as a label fallback for an unknown component', () => {
    expect(
      planMonitorActions([{ component: 'edge', status: 'degraded' }], [], now, labelOf),
    ).toEqual([
      {
        type: 'create',
        component: 'edge',
        severity: 'degraded',
        title: '[Incident] Service disruption detected on edge',
        body: 'The monitoring system detected a degraded status on edge at 2026-07-12T10:00:00.000Z.',
        labels: ['component:edge', 'severity:degraded'],
      },
    ]);
  });
});
