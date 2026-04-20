import { readOnlyQuery } from '../db/readOnlyClient.js';
import type { Filters, Metric } from '../types.js';
import { ALLOWED_METRICS } from './get_top_n.js';
import { buildWhereClause } from './_filters.js';

const VALID_GRANULARITY = new Set(['day','week','month']);

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

export type GetTimeSeriesArgs = {
  metric: Metric;
  granularity: 'day' | 'week' | 'month';
  filters: Filters;
  max_points?: number;
};

export async function getTimeSeries(args: GetTimeSeriesArgs) {
  if (!ALLOWED_METRICS.has(args.metric)) throw new Error(`invalid metric: ${args.metric}`);
  if (!VALID_GRANULARITY.has(args.granularity)) {
    throw new Error(`invalid granularity: ${args.granularity}`);
  }
  const limit = Math.max(1, Math.min(180, Math.floor(args.max_points ?? 90)));
  const { whereSql, params } = buildWhereClause(args.filters);
  const expr = METRIC_EXPR[args.metric];

  const sql = `
    SELECT date_trunc('${args.granularity}', date::timestamp)::date AS bucket,
           ${expr} AS value
    FROM performance_records
    ${whereSql}
    ${whereSql ? 'AND' : 'WHERE'} date IS NOT NULL
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT ${limit}
  `;

  const rows = await readOnlyQuery<{ bucket: string; value: number }>(sql, params);
  // Re-sort ascending after the LIMIT slice so the model sees chronological order
  const series = rows
    .map((r) => ({ bucket: r.bucket, value: Number(r.value) }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
  return { series };
}
