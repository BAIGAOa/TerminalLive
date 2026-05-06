import { describe, it, expect } from 'vitest';
import BlockedFilter from '../../../src/event/filters/BlockedFilter.js';
import type FilterContext from '../../../src/event/FilterContext.js';
import type { Incident } from '../../../src/world/Incident.js';

// 快速构建一个仅满足 FilterContext 接口的模拟对象
function mockContext(overrides: Partial<FilterContext> = {}): FilterContext {
  return {
    incident: { id: 'test-event' } as Incident,
    rangeKey: '0-10',
    triggeredHistory: new Set<string>(),
    blockedHistory: new Set<string>(),
    rangeHistory: new Map(),
    ...overrides,
  };
}

describe('BlockedFilter', () => {
  const filter = new BlockedFilter();

  it('当事件不在 blockedHistory 中时，应返回 true', () => {
    const ctx = mockContext(); // blockedHistory 为空
    expect(filter.isEligible(ctx)).toBe(true);
  });

  it('当事件在 blockedHistory 中时，应返回 false', () => {
    const ctx = mockContext({
      blockedHistory: new Set(['test-event']),
    });
    expect(filter.isEligible(ctx)).toBe(false);
  });

  it('不应受其他事件 ID 的影响', () => {
    const ctx = mockContext({
      blockedHistory: new Set(['other-event']),
    });
    expect(filter.isEligible(ctx)).toBe(true);
  });
});