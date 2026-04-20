import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('../../db/readOnlyClient.js', () => ({
  readOnlyQuery: (...args: unknown[]) => queryMock(...args),
}));

import { getFunnel } from '../get_funnel.js';

beforeEach(() => queryMock.mockReset());

describe('get_funnel', () => {
  it('returns one row with conversion percentages when no group_by', async () => {
    queryMock.mockResolvedValue([{ clicks: 1000, registrations: 100, ftds: 10 }]);
    const r = await getFunnel({ filters: {} });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].click_to_reg_pct).toBeCloseTo(0.1, 5);
    expect(r.rows[0].reg_to_ftd_pct).toBeCloseTo(0.1, 5);
    expect(r.rows[0].click_to_ftd_pct).toBeCloseTo(0.01, 5);
  });

  it('groups by brand when requested', async () => {
    queryMock.mockResolvedValue([]);
    await getFunnel({ filters: {}, group_by: 'brand' });
    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toMatch(/GROUP BY\s+brand/i);
  });

  it('returns nulls instead of NaN when denominators are zero', async () => {
    queryMock.mockResolvedValue([{ clicks: 0, registrations: 0, ftds: 0 }]);
    const r = await getFunnel({ filters: {} });
    expect(r.rows[0].click_to_reg_pct).toBeNull();
    expect(r.rows[0].reg_to_ftd_pct).toBeNull();
    expect(r.rows[0].click_to_ftd_pct).toBeNull();
  });
});
