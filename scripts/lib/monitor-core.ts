import { type ComponentId, componentLabel, type Severity } from './status-core.js';

export type ProbeMode = 'http-200' | 'api-status-json';
export type ProbeStatus = 'operational' | Severity;

export interface MonitorTarget {
  component: ComponentId;
  urlEnv: string;
  mode: ProbeMode;
}

export interface ProbeResult {
  component: ComponentId;
  status: ProbeStatus;
}

export interface OpenIncident {
  id: number;
  components: readonly ComponentId[];
}

export type MonitorAction =
  | {
      type: 'create';
      component: ComponentId;
      severity: Severity;
      title: string;
      body: string;
      labels: string[];
    }
  | { type: 'close'; issueId: number; component: ComponentId; comment: string }
  | { type: 'none'; component: ComponentId };

export interface ApiStatusPayload {
  api: ProbeStatus;
  agentExecution: ProbeStatus;
}

export function apiStatusToProbeResults(payload: ApiStatusPayload): ProbeResult[] {
  return [
    { component: 'api', status: payload.api },
    { component: 'agent-execution', status: payload.agentExecution },
  ];
}

export function unreachableApiStatus(): ProbeResult[] {
  return [
    { component: 'api', status: 'outage' },
    { component: 'agent-execution', status: 'outage' },
  ];
}

export function planMonitorActions(
  results: readonly ProbeResult[],
  openIncidents: readonly OpenIncident[],
  now: Date,
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
    const label = componentLabel(result.component);
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
