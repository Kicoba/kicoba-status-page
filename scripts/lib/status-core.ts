export type ComponentId = string;

export const severities = ['degraded', 'outage'] as const;
export type Severity = (typeof severities)[number];

export type ComponentState = 'operational' | Severity;
export type IssueState = 'open' | 'closed';

export interface ComponentDef {
  id: string;
  label: string;
}

export interface StatusIssue {
  id: number;
  title: string;
  body: string;
  labels: readonly string[];
  state: IssueState;
  openedAt: string;
  closedAt: string | null;
  url: string;
}

export interface ParsedIncident extends StatusIssue {
  components: ComponentId[];
  severity: Severity;
}

export interface DayCell {
  date: string;
  state: ComponentState;
  downtimeMinutes: number;
  incidents: number[];
}

export interface StatusComponent {
  id: ComponentId;
  label: string;
  uptime90d: number;
  cells: DayCell[];
}

export interface StatusJson {
  generatedAt: string;
  globalStatus: ComponentState;
  components: StatusComponent[];
  incidents: ParsedIncident[];
}

export interface WarningSink {
  warn(message: string): void;
}

const severityRank: Record<ComponentState, number> = {
  operational: 0,
  degraded: 1,
  outage: 2,
};

interface Interval {
  startMs: number;
  endMs: number;
}

export function parseIssue(
  issue: StatusIssue,
  validIds: ReadonlySet<string>,
  warningSink?: WarningSink,
): ParsedIncident | null {
  const components = issue.labels
    .map((label) => label.match(/^component:(.+)$/)?.[1])
    .filter((value): value is string => value !== undefined && validIds.has(value));
  if (components.length === 0) {
    warningSink?.warn(`Ignoring issue #${issue.id}: no valid component label`);
    return null;
  }

  const severity = issue.labels
    .map((label) => label.match(/^severity:(.+)$/)?.[1])
    .find((value): value is Severity => isSeverity(value));
  if (!severity) {
    warningSink?.warn(`Ignoring issue #${issue.id}: no valid severity label`);
    return null;
  }

  return { ...issue, components: [...new Set(components)], severity };
}

export function deriveGlobalStatus(incidents: readonly ParsedIncident[]): ComponentState {
  return incidents
    .filter((incident) => incident.state === 'open')
    .reduce<ComponentState>((worst, incident) => maxState(worst, incident.severity), 'operational');
}

export function buildStatusJson(
  issues: readonly StatusIssue[],
  generatedAt: Date,
  components: readonly ComponentDef[],
  warningSink?: WarningSink,
): StatusJson {
  const validIds = new Set(components.map((component) => component.id));
  const incidents = issues
    .map((issue) => parseIssue(issue, validIds, warningSink))
    .filter((incident): incident is ParsedIncident => incident !== null);
  const generatedAtIso = generatedAt.toISOString();
  return {
    generatedAt: generatedAtIso,
    globalStatus: deriveGlobalStatus(incidents),
    components: components.map((component) => ({
      id: component.id,
      label: component.label,
      uptime90d: calculateUptime90d(incidents, component.id, generatedAt),
      cells: buildDayCells(incidents, component.id, generatedAt),
    })),
    incidents: recentIncidents(incidents, generatedAt),
  };
}

export function calculateUptime90d(
  incidents: readonly ParsedIncident[],
  component: ComponentId,
  generatedAt: Date,
): number {
  const windowEnd = generatedAt.getTime();
  const windowStart = windowEnd - 90 * 24 * 60 * 60 * 1000;
  const intervals = outageIntervals(incidents, component, windowStart, windowEnd);
  const downtimeMs = mergeIntervals(intervals).reduce((sum, interval) => {
    return sum + (interval.endMs - interval.startMs);
  }, 0);
  const uptime = ((windowEnd - windowStart - downtimeMs) / (windowEnd - windowStart)) * 100;
  return round2(uptime);
}

export function buildDayCells(
  incidents: readonly ParsedIncident[],
  component: ComponentId,
  generatedAt: Date,
): DayCell[] {
  const todayStart = utcDayStart(generatedAt).getTime();
  return Array.from({ length: 90 }, (_, index) => {
    const startMs = todayStart - (89 - index) * 24 * 60 * 60 * 1000;
    const endMs = startMs + 24 * 60 * 60 * 1000;
    const active = incidents.filter((incident) =>
      incidentOverlapsComponent(incident, component, startMs, endMs),
    );
    const outage = active.filter((incident) => incident.severity === 'outage');
    const state = active.reduce<ComponentState>(
      (worst, incident) => maxState(worst, incident.severity),
      'operational',
    );
    const downtimeMs = mergeIntervals(
      outage.map((incident) => boundedInterval(incident, startMs, endMs)).filter(isInterval),
    ).reduce((sum, interval) => sum + (interval.endMs - interval.startMs), 0);
    return {
      date: formatDate(new Date(startMs)),
      state,
      downtimeMinutes: Math.round(downtimeMs / 60_000),
      incidents: active.map((incident) => incident.id).sort((a, b) => a - b),
    };
  });
}

export function overlapsWindow(issue: StatusIssue, generatedAt: Date, days: number): boolean {
  const windowStart = generatedAt.getTime() - days * 24 * 60 * 60 * 1000;
  const startMs = Date.parse(issue.openedAt);
  const endMs = issue.closedAt ? Date.parse(issue.closedAt) : generatedAt.getTime();
  return startMs < generatedAt.getTime() && endMs > windowStart;
}

function recentIncidents(
  incidents: readonly ParsedIncident[],
  generatedAt: Date,
): ParsedIncident[] {
  return incidents
    .filter((incident) => overlapsWindow(incident, generatedAt, 7))
    .sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
}

function outageIntervals(
  incidents: readonly ParsedIncident[],
  component: ComponentId,
  windowStart: number,
  windowEnd: number,
): Interval[] {
  return incidents
    .filter((incident) => incident.severity === 'outage')
    .filter((incident) => incident.components.includes(component))
    .map((incident) => boundedInterval(incident, windowStart, windowEnd))
    .filter(isInterval);
}

function incidentOverlapsComponent(
  incident: ParsedIncident,
  component: ComponentId,
  startMs: number,
  endMs: number,
): boolean {
  return (
    incident.components.includes(component) && isInterval(boundedInterval(incident, startMs, endMs))
  );
}

function boundedInterval(issue: StatusIssue, startMs: number, endMs: number): Interval | null {
  const issueStart = Date.parse(issue.openedAt);
  const issueEnd = issue.closedAt ? Date.parse(issue.closedAt) : endMs;
  const boundedStart = Math.max(issueStart, startMs);
  const boundedEnd = Math.min(issueEnd, endMs);
  return boundedStart < boundedEnd ? { startMs: boundedStart, endMs: boundedEnd } : null;
}

function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (!last || interval.startMs > last.endMs) {
      merged.push({ ...interval });
      continue;
    }
    last.endMs = Math.max(last.endMs, interval.endMs);
  }
  return merged;
}

function maxState(left: ComponentState, right: ComponentState): ComponentState {
  return severityRank[right] > severityRank[left] ? right : left;
}

function isInterval(interval: Interval | null): interval is Interval {
  return interval !== null;
}

function isSeverity(value: string | undefined): value is Severity {
  return severities.includes(value as Severity);
}

function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
