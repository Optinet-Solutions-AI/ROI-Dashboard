import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('../../db/readOnlyClient.js', () => ({
  readOnlyQuery: (...args: unknown[]) => queryMock(...args),
}));

import { runSafeSql } from '../run_safe_sql.js';

beforeEach(() => queryMock.mockReset());

describe('run_safe_sql', () => {
  it('executes the validated SELECT directly with LIMIT injected', async () => {
    queryMock.mockResolvedValue([{ brand: 'X', n: 5 }]);
    const r = await runSafeSql({
      query: 'SELECT brand, count(*) AS n FROM performance_records GROUP BY brand',
      reason: 'user asked for raw brand counts',
    });
    expect(r.rows).toEqual([{ brand: 'X', n: 5 }]);
    expect(r.row_count).toBe(1);
    expect(r.truncated).toBe(false);
    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toMatch(/LIMIT\s+500/i);
  });

  it('throws SQL_REJECTED on disallowed query', async () => {
    await expect(runSafeSql({ query: 'DELETE FROM performance_records', reason: 'evil' }))
      .rejects.toThrowError(/SQL_REJECTED/);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('marks truncated when row_count hits 500', async () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ x: i }));
    queryMock.mockResolvedValue(rows);
    const r = await runSafeSql({
      query: 'SELECT brand FROM performance_records', reason: 'list brands',
    });
    expect(r.truncated).toBe(true);
  });
});
