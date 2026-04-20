// api/_lib/safety/sqlValidator.ts
import { Parser } from 'node-sql-parser';

const ALLOWED_TABLES = new Set(['performance_records']);
const FORBIDDEN_PREFIXES = ['pg_', 'auth.', 'storage.', 'information_schema'];
const FORBIDDEN_TABLES = new Set(['ask_ai_logs']);
const MAX_LIMIT = 500;

export type ValidateResult =
  | { ok: true; sql: string }
  | { ok: false; reason: string };

const parser = new Parser();

export function validateSql(input: string): ValidateResult {
  const sql = (input ?? '').trim();
  if (!sql) return { ok: false, reason: 'empty' };

  let ast;
  try {
    ast = parser.astify(sql, { database: 'postgresql' });
  } catch (err) {
    return { ok: false, reason: `parse_error: ${(err as Error).message}` };
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length !== 1) {
    return { ok: false, reason: 'multi_statement' };
  }
  const stmt = statements[0];
  if (stmt.type !== 'select') {
    return { ok: false, reason: `non_select: ${stmt.type}` };
  }

  const tables = collectTables(stmt);
  for (const t of tables) {
    const lower = t.toLowerCase();
    if (FORBIDDEN_TABLES.has(lower)) return { ok: false, reason: `forbidden_table: ${t}` };
    if (FORBIDDEN_PREFIXES.some((p) => lower.startsWith(p))) {
      return { ok: false, reason: `forbidden_prefix: ${t}` };
    }
    const bare = lower.replace(/^public\./, '');
    if (!ALLOWED_TABLES.has(bare)) {
      return { ok: false, reason: `not_allowlisted: ${t}` };
    }
  }

  const finalSql = injectLimit(sql);
  return { ok: true, sql: finalSql };
}

function collectTables(node: any, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const item of node) collectTables(item, out);
    return out;
  }
  if (node.table && typeof node.table === 'string') {
    const qualified = node.db ? `${node.db}.${node.table}` : node.table;
    out.push(qualified);
  }
  for (const key of Object.keys(node)) collectTables(node[key], out);
  return out;
}

function injectLimit(sql: string): string {
  const trimmed = sql.replace(/;\s*$/, '');
  const limitMatch = trimmed.match(/\blimit\s+(\d+)\s*(offset\s+\d+)?\s*$/i);
  if (!limitMatch) {
    return `${trimmed} LIMIT ${MAX_LIMIT}`;
  }
  const current = parseInt(limitMatch[1], 10);
  if (current > MAX_LIMIT) {
    return trimmed.replace(/\blimit\s+\d+/i, `LIMIT ${MAX_LIMIT}`);
  }
  return trimmed;
}
