// api/_lib/db/readOnlyClient.ts
// Pooled pg client running as ask_ai_readonly. Used by all tools including
// run_safe_sql. The ask_ai_readonly role (SELECT-only, statement_timeout=5s)
// and the LIMIT injection in sqlValidator enforce safety at the connection level.

import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getReadOnlyPool(): pg.Pool {
  if (!pool) {
    const url = process.env.ASK_AI_READONLY_DATABASE_URL;
    if (!url) throw new Error('ASK_AI_READONLY_DATABASE_URL is not set');
    pool = new Pool({
      connectionString: url,
      max: 4,                       // serverless: keep small
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 5_000,
    } as any);
  }
  return pool;
}

export async function readOnlyQuery<R = any>(
  sql: string,
  params: unknown[] = [],
): Promise<R[]> {
  const client = await getReadOnlyPool().connect();
  try {
    const result = await client.query(sql, params as any[]);
    return result.rows as R[];
  } finally {
    client.release();
  }
}
