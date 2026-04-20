import { readOnlyQuery } from '../db/readOnlyClient.js';
import { validateSql } from '../safety/sqlValidator.js';

export type RunSafeSqlArgs = { query: string; reason: string };

export async function runSafeSql(args: RunSafeSqlArgs) {
  const v = validateSql(args.query);
  if (!v.ok) {
    const err = new Error(`SQL_REJECTED: ${v.reason}`);
    (err as any).code = 'SQL_REJECTED';
    throw err;
  }

  const rows = await readOnlyQuery<Record<string, unknown>>(v.sql);
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    columns,
    rows,
    row_count: rows.length,
    truncated: rows.length >= 500,
  };
}
