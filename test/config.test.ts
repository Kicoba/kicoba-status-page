import { describe, expect, it } from 'vitest';
import { loadConfig, parseConfig } from '../scripts/lib/config.js';

describe('monitor config loading', () => {
  it('loads the committed monitor.config.json with every probe resolving to a declared component', async () => {
    const config = await loadConfig('monitor.config.json');
    const ids = new Set(config.components.map((component) => component.id));
    expect(ids.size).toBeGreaterThan(0);
    for (const probe of config.probes) {
      if (probe.mode === 'http-200') {
        expect(ids.has(probe.component)).toBe(true);
      } else {
        for (const componentId of Object.values(probe.components)) {
          expect(ids.has(componentId)).toBe(true);
        }
      }
    }
  });

  it('accepts a minimal http-200 config', () => {
    const config = {
      components: [{ id: 'web', label: 'Web' }],
      probes: [{ mode: 'http-200', urlEnv: 'PROBE_URL_WEB', component: 'web' }],
    };
    expect(parseConfig(config)).toEqual(config);
  });

  it('accepts an api-status-json probe with an arbitrary key mapping', () => {
    const config = parseConfig({
      components: [
        { id: 'api', label: 'API' },
        { id: 'worker', label: 'Worker' },
      ],
      probes: [
        {
          mode: 'api-status-json',
          urlEnv: 'PROBE_URL_API',
          components: { apiStatus: 'api', workerStatus: 'worker' },
        },
      ],
    });
    expect(config.probes[0]).toMatchObject({
      mode: 'api-status-json',
      components: { apiStatus: 'api', workerStatus: 'worker' },
    });
  });

  it('rejects an http-200 probe that references an unknown component', () => {
    expect(() =>
      parseConfig({
        components: [{ id: 'web', label: 'Web' }],
        probes: [{ mode: 'http-200', urlEnv: 'PROBE_URL_X', component: 'ghost' }],
      }),
    ).toThrow(/references unknown component "ghost"/);
  });

  it('rejects an api mapping value that references an unknown component', () => {
    expect(() =>
      parseConfig({
        components: [{ id: 'api', label: 'API' }],
        probes: [{ mode: 'api-status-json', urlEnv: 'PROBE_URL_API', components: { k: 'nope' } }],
      }),
    ).toThrow(/references unknown component "nope"/);
  });

  it('rejects an unknown probe mode', () => {
    expect(() =>
      parseConfig({
        components: [{ id: 'web', label: 'Web' }],
        probes: [{ mode: 'ping', urlEnv: 'PROBE_URL_WEB', component: 'web' }],
      }),
    ).toThrow(/mode "ping" is not one of/);
  });

  it('rejects an empty api mapping', () => {
    expect(() =>
      parseConfig({
        components: [{ id: 'api', label: 'API' }],
        probes: [{ mode: 'api-status-json', urlEnv: 'PROBE_URL_API', components: {} }],
      }),
    ).toThrow(/must map at least one payload key/);
  });

  it('rejects an empty component list', () => {
    expect(() => parseConfig({ components: [], probes: [] })).toThrow(/must not be empty/);
  });

  it('rejects duplicate component ids', () => {
    expect(() =>
      parseConfig({
        components: [
          { id: 'web', label: 'Web' },
          { id: 'web', label: 'Web 2' },
        ],
        probes: [],
      }),
    ).toThrow(/duplicate id "web"/);
  });

  it('rejects a component missing its label', () => {
    expect(() => parseConfig({ components: [{ id: 'web' }], probes: [] })).toThrow(
      /label must be a non-empty string/,
    );
  });

  it('rejects a non-object root', () => {
    expect(() => parseConfig(null)).toThrow(/must be an object/);
    expect(() => parseConfig([])).toThrow(/must be an object/);
  });
});
