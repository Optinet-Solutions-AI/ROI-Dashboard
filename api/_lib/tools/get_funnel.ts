import { readOnlyQuery } from '../db/readOnlyClient.js';
import type { Dim, Filters } from '../types.js';
import { ALLOWED_DIMS, buildWhereClause } from './_filters.js';

export type GetFunnelArgs = { filters: Filters; group_by?: Dim };

export async function getFunnel(args: GetFunnelArgs) {
  if (args.group_by && !ALLOWED_DIMS.has(args.group_by)) {
    throw new Error(`invalid dimension: ${args.group_by}`);
  }
  const { whereSql, params } = buildWhereClause(args.filters);
  const dim = args.group_by;

  const sql = `
    SELECT ${dim ? `${dim},` : ''}
           COALESCE(SUM(clicks),0)::float8        AS clicks,
           COALESCE(SUM(registrations),0)::float8 AS registrations,
           COALESCE(SUM(ftds),0)::float8          AS ftds
    FROM performance_records
    ${whereSql}
    ${dim ? `GROUP BY ${dim} ORDER BY ftds DESC` : ''}
    LIMIT 200
  `;

  const raw = await readOnlyQuery<any>(sql, params);
  const rows = raw.map((r) => {
    const clicks = Number(r.clicks);
    const regs   = Number(r.registrations);
    const ftds   = Number(r.ftds);
    return {
      ...(dim ? { [dim]: r[dim] } : {}),
      clicks, registrations: regs, ftds,
      click_to_reg_pct: clicks > 0 ? regs / clicks : null,
      reg_to_ftd_pct:   regs   > 0 ? ftds / regs   : null,
      click_to_ftd_pct: clicks > 0 ? ftds / clicks : null,
    };
  });

  return { rows };
}
