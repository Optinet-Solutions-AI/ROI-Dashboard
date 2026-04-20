import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('../../db/readOnlyClient.js', () => ({
  readOnlyQuery: (...args: unknown[]) => queryMock(...args),
}));

import { getKpiSummary } from '../get_kpi_summary.js';

beforeEach(() => queryMock.mockReset());

describe('get_kpi_summary', () => {
  it('builds a totals query with no GROUP BY when group_by is empty', async () => {
    queryMock.mockResolvedValue([{ revenue: 100, cost: 40, profit: 60, roi: 1.5,
      ftds: 10, clicks: 1000, registrations: 100, cpa: 4, conversion_rate: 0.01 }]);
    const r = await getKpiSummary({ filters: {} });
    expect(r.rows).toHaveLength(1);
    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).not.toMatch(/GROUP BY/i);
    expect(sql).toMatch(/FROM\s+performance_records/i);
  });

  it('adds GROUP BY for each requested dimension', async () => {
    queryMock.mockResolvedValue([]);
    await getKpiSummary({ filters: {}, group_by: ['brand', 'country'] });
    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toMatch(/GROUP BY\s+brand,\s*country/i);
    expect(sql).toMatch(/SELECT[\s\S]*brand[\s\S]*country/i);
  });

  it('parametrises filters as $1, $2, ...', async () => {
    queryMock.mockResolvedValue([]);
    await getKpiSummary({
      filters: { brand: 'Casino', country: ['BR', 'PT'], date_from: '2026-01-01' },
    });
    const [, params] = queryMock.mock.calls[0];
    expect(params).toEqual(['Casino', ['BR', 'PT'], '2026-01-01']);
  });

  it('rejects an unknown group_by dimension', async () => {
    await expect(
      getKpiSummary({ filters: {}, group_by: ['; DROP TABLE x' as any] }),
    ).rejects.toThrow(/invalid dimension/i);
  });

  it('rejects an unknown filter key', async () => {
    await expect(
      getKpiSummary({ filters: { evil: 'x' } as any }),
    ).rejects.toThrow(/invalid filter/i);
  });
});
