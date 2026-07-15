import { describe, expect, it } from 'vitest';
import { findLeakage } from '../scripts/leakage-guard.js';

describe('public leakage guard', () => {
  it('allows functional public status labels', () => {
    expect(
      findLeakage('site/status.json', 'Landing Page App API Data Room Agent Execution'),
    ).toEqual([]);
  });

  it('rejects internal implementation names', () => {
    expect(findLeakage('site/status.json', 'LiteLLM degraded')).toEqual([
      { path: 'site/status.json', token: 'litellm' },
    ]);
  });
});
