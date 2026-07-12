import type { Severity } from './status-core.js';

export type ProbeMode = 'http-200' | 'api-status-json';
export type ProbeStatus = 'operational' | Severity;

export type MonitorTarget =
  | { mode: 'http-200'; urlEnv: string; component: string }
  | { mode: 'api-status-json'; urlEnv: string; components: Record<string, string> };

export interface ProbeResult {
  component: string;
  status: ProbeStatus;
}

export interface OpenIncident {
  id: number;
  components: readonly string[];
}

export type MonitorAction =
  | {
      type: 'create';
      component: string;
      severity: Severity;
      title: string;
      body: string;
      labels: string[];
    }
  | { type: 'close'; issueId: number; component: string; comment: string }
  | { type: 'none'; component: string };

export function apiStatusToProbeResults(
  payload: Record<string, ProbeStatus>,
  mapping: Record<string, string>,
): ProbeResult[] {
  return Object.entries(mapping).map(([payloadKey, componentId]) => ({
    component: componentId,
    status: payload[payloadKey] ?? 'outage',
  }));
}

export function unreachableApiStatus(mapping: Record<string, string>): ProbeResult[] {
  return Object.values(mapping).map((componentId) => ({
    component: componentId,
    status: 'outage',
  }));
}

export function planMonitorActions(
  results: readonly ProbeResult[],
  openIncidents: readonly OpenIncident[],
  now: Date,
  labelOf: (id: string) => string,
): MonitorAction[] {
  return results.map((result) => {
    const existing = openIncidents.find((incident) =>
      incident.components.includes(result.component),
    );
    if (result.status === 'operational') {
      if (!existing) {
        return { type: 'none', component: result.component };
      }
      return {
        type: 'close',
        issueId: existing.id,
        component: result.component,
        comment: 'Service is operational again. Automatically resolved by the monitoring system.',
      };
    }
    if (existing) {
      return { type: 'none', component: result.component };
    }
    const label = labelOf(result.component);
    return {
      type: 'create',
      component: result.component,
      severity: result.status,
      title: `[Incident] Service disruption detected on ${label}`,
      body: `The monitoring system detected a ${result.status} status on ${label} at ${now.toISOString()}.`,
      labels: [`component:${result.component}`, `severity:${result.status}`],
    };
  });
}
