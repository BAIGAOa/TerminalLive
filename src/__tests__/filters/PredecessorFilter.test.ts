import { describe, it, expect } from 'vitest';
import PredecessorFilter from '../../../src/event/filters/PredecessorFilter.js';
import type FilterContext from '../../../src/event/FilterContext.js';
import type { Incident } from '../../../src/world/Incident.js';

function mockIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'current',
    predecessorEvent: null,
    ...overrides,
  } as Incident;
}

function mockContext(overrides: Partial<FilterContext> = {}): FilterContext {
  return {
    incident: mockIncident(),
    rangeKey: '0-10',
    triggeredHistory: new Set(),
    blockedHistory: new Set(),
    rangeHistory: new Map(),
    ...overrides,
  };
}

describe('PredecessorFilter', () => {
  const filter = new PredecessorFilter();

  it('如果没有前置事件要求，应返回 true', () => {
    const ctx = mockContext({
      incident: mockIncident({ predecessorEvent: null }),
    });
    expect(filter.isEligible(ctx)).toBe(true);
  });

  it('如果前置事件已触发，应返回 true', () => {
    const ctx = mockContext({
      incident: mockIncident({ predecessorEvent: 'pre-ev' }),
      triggeredHistory: new Set(['pre-ev']),
    });
    expect(filter.isEligible(ctx)).toBe(true);
  });

  it('如果前置事件未触发，应返回 false', () => {
    const ctx = mockContext({
      incident: mockIncident({ predecessorEvent: 'pre-ev' }),
      triggeredHistory: new Set(['other-ev']),
    });
    expect(filter.isEligible(ctx)).toBe(false);
  });
});