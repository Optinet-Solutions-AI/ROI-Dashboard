import { readOnlyQuery } from '../db/readOnlyClient.js';
import type { Dim, Filters } from '../types.js';
import { buildWhereClause, ALLOWED_DIMS } from './_filters.js';

const KPI_SELECT = `
  COALESCE(SUM(revenue), 0)::float8                               AS revenue,
  COALESCE(SUM(cost), 0)::float8                                  AS cost,
  COALESCE(SUM(revenue) - SUM(cost), 0)::float8                   AS profit,
  CASE WHEN SUM(cost) > 0
       THEN ((SUM(revenue) - SUM(cost)) / SUM(cost))::float8
       ELSE NULL END                                              AS roi,
  COALESCE(SUM(ftds), 0)::float8                                  AS ftds,
  COALESCE(SUM(clicks), 0)::float8                                AS clicks,
  COALESCE(SUM(registrations), 0)::float8                         AS registrations,
  CASE WHEN SUM(ftds) > 0
       THEN (SUM(cost) / SUM(ftds))::float8 ELSE NULL END         AS cpa,
  CASE WHEN SUM(clicks) > 0
       THEN (SUM(ftds) / SUM(clicks))::float8 ELSE NULL END       AS conversion_rate
`;

export type GetKpiSummaryArgs = { filters: Filters; group_by?: Dim[] };

export async function getKpiSummary(args: GetKpiSummaryArgs) {
  const groupBy = args.group_by ?? [];
  for (const d of groupBy) {
    if (!ALLOWED_DIMS.has(d)) throw new Error(`invalid dimension: ${d}`);
  }
  const { whereSql, params } = buildWhereClause(args.filters);

  const dimList = groupBy.length ? groupBy.join(', ') : '';
  const select  = dimList ? `${dimList}, ${KPI_SELECT}` : KPI_SELECT;
  const groupClause = dimList ? `GROUP BY ${dimList} ORDER BY profit DESC NULLS LAST` : '';

  const sql = `
    SELECT ${select}
    FROM performance_records
    ${whereSql}
    ${groupClause}
    LIMIT 200
  `;

  const rows = await readOnlyQuery(sql, params);
  return { rows };
}
