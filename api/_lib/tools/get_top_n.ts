import { readOnlyQuery } from '../db/readOnlyClient.js';
import type { Dim, Filters, Metric } from '../types.js';
import { ALLOWED_DIMS, buildWhereClause } from './_filters.js';

export const ALLOWED_METRICS: Set<Metric> = new Set([
  'revenue','cost','profit','roi','ftds','clicks','registrations',
  'cpa','conversion_rate','casino_real_ngr','sb_real_ngr','flats_and_adjustments',
]);

const METRIC_EXPR: Record<Metric, string> = {
  revenue:               'COALESCE(SUM(revenue),0)::float8',
  cost:                  'COALESCE(SUM(cost),0)::float8',
  profit:                'COALESCE(SUM(revenue)-SUM(cost),0)::float8',
  roi:                   'CASE WHEN SUM(cost)>0 THEN ((SUM(revenue)-SUM(cost))/SUM(cost))::float8 ELSE NULL END',
  ftds:                  'COALESCE(SUM(ftds),0)::float8',
  clicks:                'COALESCE(SUM(clicks),0)::float8',
  registrations:         'COALESCE(SUM(registrations),0)::float8',
  cpa:                   'CASE WHEN SUM(ftds)>0 THEN (SUM(cost)/SUM(ftds))::float8 ELSE NULL END',
  conversion_rate:       'CASE WHEN SUM(clicks)>0 THEN (SUM(ftds)/SUM(clicks))::float8 ELSE NULL END',
  casino_real_ngr:       'COALESCE(SUM(casino_real_ngr),0)::float8',
  sb_real_ngr:           'COALESCE(SUM(sb_real_ngr),0)::float8',
  flats_and_adjustments: 'COALESCE(SUM(flats_and_adjustments),0)::float8',
};

export type GetTopNArgs = {
  dimension: Dim;
  metric: Metric;
  filters: Filters;
  limit: number;
  order: 'desc' | 'asc';
};

export async function getTopN(args: GetTopNArgs) {
  if (!ALLOWED_DIMS.has(args.dimension))    throw new Error(`invalid dimension: ${args.dimension}`);
  if (!ALLOWED_METRICS.has(args.metric))    throw new Error(`invalid metric: ${args.metric}`);
  const order = args.order === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.max(1, Math.min(50, Math.floor(args.limit)));

  const { whereSql, params } = buildWhereClause(args.filters);
  const expr = METRIC_EXPR[args.metric];

  const sql = `
    SELECT ${args.dimension},
           ${expr} AS ${args.metric},
           COALESCE(SUM(revenue),0)::float8 AS revenue,
           COALESCE(SUM(cost),0)::float8 AS cost,
           COALESCE(SUM(ftds),0)::float8 AS ftds
    FROM performance_records
    ${whereSql}
    GROUP BY ${args.dimension}
    ORDER BY ${args.metric} ${order} NULLS LAST
    LIMIT ${limit}
  `;

  const rows = await readOnlyQuery(sql, params);
  return { rows };
}
