import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('../../db/readOnlyClient.js', () => ({
  readOnlyQuery: (...args: unknown[]) => queryMock(...args),
}));

import { comparePeriods } from '../compare_periods.js';

beforeEach(() => queryMock.mockReset());

describe('compare_periods', () => {
  it('returns deltas between two period totals', async () => {
    queryMock
      .mockResolvedValueOnce([{ revenue: 100, profit: 60 }])  // period A
      .mockResolvedValueOnce([{ revenue: 150, profit: 50 }]); // period B
    const r = await comparePeriods({
      filters: {},
      period_a: { from: '2026-01-01', to: '2026-01-31' },
      period_b: { from: '2026-02-01', to: '2026-02-28' },
      metrics: ['revenue', 'profit'],
    });
    expect(r.a.revenue).toBe(100);
    expect(r.b.revenue).toBe(150);
    expect(r.delta_abs.revenue).toBe(50);
    expect(r.delta_pct.revenue).toBeCloseTo(0.5, 5);
    expect(r.delta_abs.profit).toBe(-10);
  });

  it('handles divide-by-zero in delta_pct as null', async () => {
    queryMock
      .mockResolvedValueOnce([{ revenue: 0 }])
      .mockResolvedValueOnce([{ revenue: 100 }]);
    const r = await comparePeriods({
      filters: {},
      period_a: { from: '2026-01-01', to: '2026-01-31' },
      period_b: { from: '2026-02-01', to: '2026-02-28' },
      metrics: ['revenue'],
    });
    expect(r.delta_pct.revenue).toBeNull();
  });

  it('rejects invalid metric', async () => {
    await expect(comparePeriods({
      filters: {},
      period_a: { from: '2026-01-01', to: '2026-01-31' },
      period_b: { from: '2026-02-01', to: '2026-02-28' },
      metrics: ['evil' as any],
    })).rejects.toThrow(/invalid metric/i);
  });
});
