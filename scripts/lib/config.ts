import { readFile } from 'node:fs/promises';
import type { MonitorTarget } from './monitor-core.js';
import type { ComponentDef } from './status-core.js';

export type ProbeConfig = MonitorTarget;

export interface PrivateProbeConfig {
  id: string;
  urlEnv: string;
  mode: 'http-status';
  expectedStatus: number;
}

export interface MonitorConfig {
  components: ComponentDef[];
  probes: ProbeConfig[];
  privateProbes: PrivateProbeConfig[];
}

const probeModes = ['http-200', 'api-status-json'] as const;
const privateProbeModes = ['http-status'] as const;

export async function loadConfig(path = 'monitor.config.json'): Promise<MonitorConfig> {
  const raw = await readFile(path, 'utf8');
  return parseConfig(JSON.parse(raw), path);
}

// The config file is the single surface an adopter edits by hand, so a wrong
// value must fail here with a message that names the field, not crash later
// deep inside a probe. Validation also enforces the invariant the ComponentId
// type no longer can: every id a probe references must be a declared component.
export function parseConfig(value: unknown, source = 'config'): MonitorConfig {
  const root = asObject(value, source);
  const components = parseComponents(root.components, source);
  const validIds = new Set(components.map((component) => component.id));
  const probes = asArray(root.probes, `${source}.probes`).map((probe, index) =>
    parseProbe(probe, validIds, `${source}.probes[${index}]`),
  );
  const privateProbes = asOptionalArray(root.privateProbes, `${source}.privateProbes`).map(
    (probe, index) => parsePrivateProbe(probe, `${source}.privateProbes[${index}]`),
  );
  return { components, probes, privateProbes };
}

function parseComponents(value: unknown, source: string): ComponentDef[] {
  const entries = asArray(value, `${source}.components`);
  if (entries.length === 0) {
    throw new Error(`${source}.components must not be empty`);
  }
  const components = entries.map((entry, index) =>
    parseComponent(entry, `${source}.components[${index}]`),
  );
  const ids = new Set<string>();
  for (const component of components) {
    if (ids.has(component.id)) {
      throw new Error(`${source}.components has a duplicate id "${component.id}"`);
    }
    ids.add(component.id);
  }
  return components;
}

function parseComponent(value: unknown, source: string): ComponentDef {
  const record = asObject(value, source);
  return {
    id: asNonEmptyString(record.id, `${source}.id`),
    label: asNonEmptyString(record.label, `${source}.label`),
  };
}

function parseProbe(value: unknown, validIds: ReadonlySet<string>, source: string): ProbeConfig {
  const record = asObject(value, source);
  const mode = asNonEmptyString(record.mode, `${source}.mode`);
  const urlEnv = asNonEmptyString(record.urlEnv, `${source}.urlEnv`);
  if (mode === 'http-200') {
    const component = asNonEmptyString(record.component, `${source}.component`);
    requireKnownComponent(component, validIds, `${source}.component`);
    return { mode, urlEnv, component };
  }
  if (mode === 'api-status-json') {
    return { mode, urlEnv, components: parseMapping(record.components, validIds, source) };
  }
  throw new Error(`${source}.mode "${mode}" is not one of ${probeModes.join(', ')}`);
}

function parsePrivateProbe(value: unknown, source: string): PrivateProbeConfig {
  const record = asObject(value, source);
  const mode = asNonEmptyString(record.mode, `${source}.mode`);
  if (mode !== 'http-status') {
    throw new Error(`${source}.mode "${mode}" is not one of ${privateProbeModes.join(', ')}`);
  }
  return {
    id: asNonEmptyString(record.id, `${source}.id`),
    urlEnv: asNonEmptyString(record.urlEnv, `${source}.urlEnv`),
    mode,
    expectedStatus: asHttpStatus(record.expectedStatus, `${source}.expectedStatus`),
  };
}

function parseMapping(
  value: unknown,
  validIds: ReadonlySet<string>,
  source: string,
): Record<string, string> {
  const record = asObject(value, `${source}.components`);
  const entries = Object.entries(record);
  if (entries.length === 0) {
    throw new Error(`${source}.components must map at least one payload key to a component`);
  }
  const mapping: Record<string, string> = {};
  for (const [key, mapped] of entries) {
    const componentId = asNonEmptyString(mapped, `${source}.components.${key}`);
    requireKnownComponent(componentId, validIds, `${source}.components.${key}`);
    mapping[key] = componentId;
  }
  return mapping;
}

function requireKnownComponent(id: string, validIds: ReadonlySet<string>, source: string): void {
  if (!validIds.has(id)) {
    throw new Error(`${source} references unknown component "${id}"`);
  }
}

function asObject(value: unknown, source: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${source} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asOptionalArray(value: unknown, source: string): unknown[] {
  if (value === undefined) {
    return [];
  }
  return asArray(value, source);
}

function asArray(value: unknown, source: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${source} must be an array`);
  }
  return value;
}

function asNonEmptyString(value: unknown, source: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${source} must be a non-empty string`);
  }
  return value;
}

function asHttpStatus(value: unknown, source: string): number {
  if (!Number.isInteger(value) || typeof value !== 'number' || value < 100 || value > 599) {
    throw new Error(`${source} must be an HTTP status code`);
  }
  return value;
}
