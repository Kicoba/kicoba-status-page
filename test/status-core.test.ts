import { describe, expect, it } from 'vitest';
import {
  buildDayCells,
  buildStatusJson,
  type ComponentDef,
  calculateUptime90d,
  type ParsedIncident,
  parseIssue,
  type StatusIssue,
} from '../scripts/lib/status-core.js';

const generatedAt = new Date('2026-07-12T00:00:00.000Z');

const components: ComponentDef[] = [
  { id: 'landing', label: 'Landing Page' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'api', label: 'API' },
  { id: 'agent-execution', label: 'Agent Execution' },
];
const validIds = new Set(components.map((component) => component.id));

function parsed(issues: (StatusIssue | null)[]): ParsedIncident[] {
  return issues
    .map((item) => (item === null ? null : parseIssue(item, validIds)))
    .filter((item): item is ParsedIncident => item !== null);
}

function issue(overrides: Partial<StatusIssue> = {}): StatusIssue {
  return {
    id: 1,
    title: 'Incident',
    body: 'Public incident copy',
    labels: ['component:api', 'severity:outage'],
    state: 'closed',
    openedAt: '2026-07-11T23:00:00.000Z',
    closedAt: '2026-07-12T00:00:00.000Z',
    url: 'https://github.com/Kicoba/kicoba-status-page/issues/1',
    ...overrides,
  };
}

describe('status page pure logic', () => {
  it('parses component and severity labels and warns on invalid component issues', () => {
    const warnings: string[] = [];
    expect(
      parseIssue(
        issue({ labels: ['component:api', 'component:agent-execution', 'severity:degraded'] }),
        validIds,
      ),
    ).toMatchObject({
      components: ['api', 'agent-execution'],
      severity: 'degraded',
    });
    expect(
      parseIssue(issue({ labels: ['severity:outage'] }), validIds, {
        warn: (message) => warnings.push(message),
      }),
    ).toBeNull();
    expect(warnings).toEqual(['Ignoring issue #1: no valid component label']);
  });

  it('calculates uptime from outage minutes only', () => {
    const outage = parsed([issue()]);
    expect(calculateUptime90d(outage, 'api', generatedAt)).toBe(99.95);
    const degraded = parsed([issue({ labels: ['component:api', 'severity:degraded'] })]);
    expect(calculateUptime90d(degraded, 'api', generatedAt)).toBe(100);
  });

  it('does not double count concurrent outage intervals', () => {
    const incidents = parsed([
      issue({ id: 1, openedAt: '2026-07-11T22:00:00.000Z', closedAt: '2026-07-12T00:00:00.000Z' }),
      issue({ id: 2, openedAt: '2026-07-11T23:00:00.000Z', closedAt: '2026-07-12T00:00:00.000Z' }),
    ]);
    expect(calculateUptime90d(incidents, 'api', generatedAt)).toBe(99.91);
  });

  it('bounds open and boundary-crossing incidents to the 90-day window', () => {
    const incidents = parsed([
      issue({ openedAt: '2026-04-12T00:00:00.000Z', closedAt: '2026-04-14T00:00:00.000Z' }),
      issue({ id: 2, openedAt: '2026-07-11T12:00:00.000Z', closedAt: null, state: 'open' }),
    ]);
    expect(calculateUptime90d(incidents, 'api', generatedAt)).toBe(98.33);
  });

  it('builds 90 cells and lets the worst severity of the day win', () => {
    const incidents = parsed([
      issue({
        id: 1,
        labels: ['component:api', 'severity:degraded'],
        openedAt: '2026-07-10T01:00:00.000Z',
        closedAt: '2026-07-10T02:00:00.000Z',
      }),
      issue({
        id: 2,
        labels: ['component:api', 'severity:outage'],
        openedAt: '2026-07-10T03:00:00.000Z',
        closedAt: '2026-07-10T03:30:00.000Z',
      }),
    ]);
    const cells = buildDayCells(incidents, 'api', generatedAt);
    expect(cells).toHaveLength(90);
    expect(cells.find((cell) => cell.date === '2026-07-10')).toMatchObject({
      state: 'outage',
      downtimeMinutes: 30,
      incidents: [1, 2],
    });
  });

  it('generates status.json without invalid issues and with recent incidents only', () => {
    const status = buildStatusJson(
      [
        issue({ id: 1, state: 'open', openedAt: '2026-07-11T23:00:00.000Z', closedAt: null }),
        issue({ id: 2, labels: ['severity:outage'], openedAt: '2026-07-11T23:00:00.000Z' }),
        issue({
          id: 3,
          openedAt: '2026-06-01T00:00:00.000Z',
          closedAt: '2026-06-01T01:00:00.000Z',
        }),
      ],
      generatedAt,
      components,
    );
    expect(status.globalStatus).toBe('outage');
    expect(status.incidents.map((incident) => incident.id)).toEqual([1]);
    expect(status.components.find((component) => component.id === 'api')?.cells).toHaveLength(90);
  });

  it('drives a completely different component set end to end', () => {
    const custom: ComponentDef[] = [{ id: 'web', label: 'Web' }];
    const customValidIds = new Set(custom.map((component) => component.id));

    const webIncident = parseIssue(
      issue({ id: 5, labels: ['component:web', 'severity:outage'] }),
      customValidIds,
    );
    expect(webIncident?.components).toEqual(['web']);

    const status = buildStatusJson(
      [
        issue({
          id: 5,
          labels: ['component:web', 'severity:outage'],
          state: 'open',
          openedAt: '2026-07-11T23:00:00.000Z',
          closedAt: null,
        }),
      ],
      generatedAt,
      custom,
    );
    expect(status.components.map((component) => component.id)).toEqual(['web']);
    expect(status.components.map((component) => component.label)).toEqual(['Web']);
    expect(status.globalStatus).toBe('outage');
    expect(status.incidents.map((incident) => incident.id)).toEqual([5]);

    const ignored = parseIssue(
      issue({ labels: ['component:api', 'severity:outage'] }),
      customValidIds,
    );
    expect(ignored).toBeNull();
  });
});
