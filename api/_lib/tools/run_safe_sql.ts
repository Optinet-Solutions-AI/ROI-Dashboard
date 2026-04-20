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

  const result = await readOnlyQuery<{ ask_query: unknown[] }>(
    'SELECT public.ask_query($1) AS ask_query',
    [v.sql],
  );
  const rows = (result[0]?.ask_query ?? []) as Record<string, unknown>[];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    columns,
    rows,
    row_count: rows.length,
    truncated: rows.length >= 500,
  };
}
