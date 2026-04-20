import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('../../db/readOnlyClient.js', () => ({
  readOnlyQuery: (...args: unknown[]) => queryMock(...args),
}));

import { getTimeSeries } from '../get_time_series.js';

beforeEach(() => queryMock.mockReset());

describe('get_time_series', () => {
  it('truncates to day for granularity=day', async () => {
    queryMock.mockResolvedValue([]);
    await getTimeSeries({ metric: 'revenue', granularity: 'day', filters: {} });
    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toMatch(/date_trunc\('day'/i);
  });

  it('uses week trunc for granularity=week', async () => {
    queryMock.mockResolvedValue([]);
    await getTimeSeries({ metric: 'revenue', granularity: 'week', filters: {} });
    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toMatch(/date_trunc\('week'/i);
  });

  it('caps max_points to 180', async () => {
    queryMock.mockResolvedValue([]);
    await getTimeSeries({ metric: 'revenue', granularity: 'day', filters: {}, max_points: 9999 });
    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toMatch(/LIMIT\s+180/);
  });

  it('rejects invalid metric', async () => {
    await expect(getTimeSeries({
      metric: 'evil' as any, granularity: 'day', filters: {},
    })).rejects.toThrow(/invalid metric/i);
  });

  it('rejects invalid granularity', async () => {
    await expect(getTimeSeries({
      metric: 'revenue', granularity: 'fortnight' as any, filters: {},
    })).rejects.toThrow(/invalid granularity/i);
  });
});
