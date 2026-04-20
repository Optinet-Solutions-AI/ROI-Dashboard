import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('../../db/readOnlyClient.js', () => ({
  readOnlyQuery: (...args: unknown[]) => queryMock(...args),
}));

import { getTopN } from '../get_top_n.js';

beforeEach(() => queryMock.mockReset());

describe('get_top_n', () => {
  it('orders by metric desc by default', async () => {
    queryMock.mockResolvedValue([]);
    await getTopN({ dimension: 'affiliate_id', metric: 'profit', filters: {}, limit: 5, order: 'desc' });
    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toMatch(/ORDER BY\s+profit\s+DESC/i);
    expect(sql).toMatch(/LIMIT\s+5/);
    expect(sql).toMatch(/GROUP BY\s+affiliate_id/i);
  });

  it('caps limit at 50', async () => {
    queryMock.mockResolvedValue([]);
    await getTopN({ dimension: 'brand', metric: 'revenue', filters: {}, limit: 9999, order: 'desc' });
    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toMatch(/LIMIT\s+50/);
  });

  it('rejects invalid dimension', async () => {
    await expect(getTopN({
      dimension: '; DROP TABLE x' as any, metric: 'profit', filters: {}, limit: 5, order: 'desc',
    })).rejects.toThrow(/invalid dimension/i);
  });

  it('rejects invalid metric', async () => {
    await expect(getTopN({
      dimension: 'brand', metric: 'evil' as any, filters: {}, limit: 5, order: 'desc',
    })).rejects.toThrow(/invalid metric/i);
  });
});
