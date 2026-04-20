import { getKpiSummary } from './get_kpi_summary.js';
import type { Filters, Metric } from '../types.js';
import { ALLOWED_METRICS } from './get_top_n.js';

export type ComparePeriodsArgs = {
  filters: Filters;
  period_a: { from: string; to: string };
  period_b: { from: string; to: string };
  metrics: Metric[];
};

export async function comparePeriods(args: ComparePeriodsArgs) {
  for (const m of args.metrics) {
    if (!ALLOWED_METRICS.has(m)) throw new Error(`invalid metric: ${m}`);
  }

  const [a, b] = await Promise.all([
    getKpiSummary({ filters: { ...args.filters, date_from: args.period_a.from, date_to: args.period_a.to } }),
    getKpiSummary({ filters: { ...args.filters, date_from: args.period_b.from, date_to: args.period_b.to } }),
  ]);

  const aRow = a.rows[0] ?? {};
  const bRow = b.rows[0] ?? {};
  const aOut: Record<string, number> = {};
  const bOut: Record<string, number> = {};
  const deltaAbs: Record<string, number> = {};
  const deltaPct: Record<string, number | null> = {};

  for (const m of args.metrics) {
    const av = Number(aRow[m] ?? 0);
    const bv = Number(bRow[m] ?? 0);
    aOut[m] = av;
    bOut[m] = bv;
    deltaAbs[m] = bv - av;
    deltaPct[m] = av === 0 ? null : (bv - av) / av;
  }

  return { a: aOut, b: bOut, delta_abs: deltaAbs, delta_pct: deltaPct };
}
