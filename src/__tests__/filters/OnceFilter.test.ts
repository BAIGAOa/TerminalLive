import { describe, it, expect } from 'vitest';
import OnceFilter from '../../../src/event/filters/OnceFilter.js';
import type FilterContext from '../../../src/event/FilterContext.js';
import type { Incident } from '../../../src/world/Incident.js';

function mockIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'default-id',
    once: false,
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

describe('OnceFilter', () => {
  const filter = new OnceFilter();

  it('默认情况 (once=false) 应返回 true', () => {
    const ctx = mockContext();
    expect(filter.isEligible(ctx)).toBe(true);
  });

  describe('post 事件', () => {
    it('如果已在全局触发过，返回 false', () => {
      const ctx = mockContext({
        incident: mockIncident({ id: 'post-ev', once: true }),
        rangeKey: 'post',
        triggeredHistory: new Set(['post-ev']),
      });
      expect(filter.isEligible(ctx)).toBe(false);
    });

    it('如果未触发过，返回 true', () => {
      const ctx = mockContext({
        incident: mockIncident({ id: 'post-ev', once: true }),
        rangeKey: 'post',
        triggeredHistory: new Set(),
      });
      expect(filter.isEligible(ctx)).toBe(true);
    });
  });

  describe('once 为 true', () => {
    it('已触发过返回 false', () => {
      const ctx = mockContext({
        incident: mockIncident({ id: 'once-ev', once: true }),
        triggeredHistory: new Set(['once-ev']),
      });
      expect(filter.isEligible(ctx)).toBe(false);
    });

    it('未触发过返回 true', () => {
      const ctx = mockContext({
        incident: mockIncident({ id: 'once-ev', once: true }),
        triggeredHistory: new Set(),
      });
      expect(filter.isEligible(ctx)).toBe(true);
    });
  });

  describe('once 为字符串数组', () => {
    it('当前 range 已触发过，返回 false', () => {
      const ctx = mockContext({
        incident: mockIncident({ id: 'ev', once: ['5-10', '10-20'] }),
        rangeKey: '5-10',
        rangeHistory: new Map([['ev', new Set(['5-10'])]]),
      });
      expect(filter.isEligible(ctx)).toBe(false);
    });

    it('当前 range 未触发过，返回 true', () => {
      const ctx = mockContext({
        incident: mockIncident({ id: 'ev', once: ['5-10', '10-20'] }),
        rangeKey: '10-20',
        rangeHistory: new Map([['ev', new Set(['5-10'])]]),
      });
      expect(filter.isEligible(ctx)).toBe(true);
    });

    it('如果事件没在 once 列表中（意外情况），也返回 true', () => {
      const ctx = mockContext({
        incident: mockIncident({ id: 'ev', once: ['5-10', '10-20'] }),
        rangeKey: '30-40',
        rangeHistory: new Map([['ev', new Set(['30-40'])]]),
      });
      expect(filter.isEligible(ctx)).toBe(true);
    });
  });
});