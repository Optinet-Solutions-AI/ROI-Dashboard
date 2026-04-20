import type { Dim, Filters } from '../types.js';

export const ALLOWED_DIMS: Set<Dim> = new Set([
  'affiliate_id','affiliate_name','country','campaign','brand','am','source',
]);

const ALLOWED_FILTER_KEYS = new Set<keyof Filters>([
  'affiliate_id','affiliate_name','country','campaign','brand','am','source','period',
  'date_from','date_to',
]);

export function buildWhereClause(filters: Filters): { whereSql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  for (const key of Object.keys(filters) as (keyof Filters)[]) {
    if (!ALLOWED_FILTER_KEYS.has(key)) throw new Error(`invalid filter: ${String(key)}`);
    const value = filters[key];
    if (value === undefined || value === null || value === '') continue;

    if (key === 'date_from') { clauses.push(`date >= $${p}`); params.push(value); p++; continue; }
    if (key === 'date_to')   { clauses.push(`date <= $${p}`); params.push(value); p++; continue; }

    if (Array.isArray(value)) {
      clauses.push(`${key} = ANY($${p})`); params.push(value); p++;
    } else {
      clauses.push(`${key} = $${p}`); params.push(value); p++;
    }
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { whereSql, params };
}
