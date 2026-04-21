import type { PerformanceRecord } from './kpiEngine';

export type CohortMetric = 'revenue' | 'ftds' | 'profit' | 'ngr' | 'cost';

export interface CohortAggregate {
  periods:   number[];                          // sorted ascending, e.g. [0, 1, 2, 3]
  cohorts:   string[];                          // sorted alphabetically, e.g. ['2026-01', '2026-02']
  chartData: Record<string, number>[];          // one entry per period: { period, [cohort]: value, ... }
}

interface Opts { metric: CohortMetric; }

function valueOf(row: PerformanceRecord, metric: CohortMetric): number {
  const rev  = Number(row.revenue) || 0;
  const cost = Number(row.cost)    || 0;
  switch (metric) {
    case 'revenue': return rev;
    case 'cost':    return cost;
    case 'profit':  return rev - cost;
    case 'ftds':    return Number(row.ftds) || 0;
    case 'ngr':     return (Number(row.casino_real_ngr) || 0) + (Number(row.sb_real_ngr) || 0);
  }
}

// Months since FTD month, derived from date and ftd_month when period is absent.
function resolvePeriod(row: PerformanceRecord): number | null {
  const stored = Number(row.period);
  if (Number.isFinite(stored)) return stored;

  const dateStr     = String(row.date      ?? '').trim();
  const ftdMonthStr = String(row.ftd_month ?? '').trim();
  if (!dateStr || !ftdMonthStr) return null;

  const dm = /^(\d{4})-(\d{2})/.exec(dateStr);
  const fm = /^(\d{4})-(\d{2})/.exec(ftdMonthStr);
  if (!dm || !fm) return null;

  return (Number(dm[1]) - Number(fm[1])) * 12 + (Number(dm[2]) - Number(fm[2]));
}

/**
 * Cohort-ladder aggregation: for each (ftd_month, period) pair, sum the chosen
 * metric, then pivot so the result can feed a recharts LineChart directly —
 * one data entry per period, one series per cohort.
 *
 * `period` is taken from the record field when present; otherwise derived as
 * months between `date` and `ftd_month` so existing Supabase rows without a
 * stored period still produce cohort data.
 *
 * Rows are skipped when `ftd_month` is blank or period cannot be resolved.
 */
export function cohortAggregate(data: PerformanceRecord[], opts: Opts): CohortAggregate {
  const buckets = new Map<string, Map<number, number>>();
  const cohortSet  = new Set<string>();
  const periodSet  = new Set<number>();

  for (const row of data) {
    const cohort = String(row.ftd_month ?? '').trim();
    if (!cohort) continue;
    const periodNum = resolvePeriod(row);
    if (periodNum === null) continue;

    cohortSet.add(cohort);
    periodSet.add(periodNum);

    if (!buckets.has(cohort)) buckets.set(cohort, new Map());
    const inner = buckets.get(cohort)!;
    inner.set(periodNum, (inner.get(periodNum) ?? 0) + valueOf(row, opts.metric));
  }

  const periods = [...periodSet].sort((a, b) => a - b);
  const cohorts = [...cohortSet].sort();

  const chartData = periods.map(period => {
    const entry: Record<string, number> = { period };
    for (const cohort of cohorts) {
      const v = buckets.get(cohort)?.get(period);
      if (v !== undefined) entry[cohort] = v;
    }
    return entry;
  });

  return { periods, cohorts, chartData };
}
