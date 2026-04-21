import type { PerformanceRecord } from './kpiEngine';
import { processKPIs } from './kpiEngine';

export type PivotKey = keyof PerformanceRecord;

export interface PivotRow {
  key: string;                                    // e.g. 'SP', 'DE', '2026-03', '1'
  count: number;                                  // rows contributing to this group
  kpis: ReturnType<typeof processKPIs>;           // full KPI set for the group
}

/**
 * Group records by the given dimension and compute the full KPI set
 * (revenue, cost, profit, ROI, FTD, ADPU, ARPU, ECPA, %Bonus, %Cashout, etc.)
 * for each group via the existing processKPIs. This is what lets every
 * pivot page render the same KPI columns the Overview uses.
 */
export function pivotAggregate(
  data: PerformanceRecord[],
  groupBy: PivotKey,
): PivotRow[] {
  const groups = new Map<string, PerformanceRecord[]>();

  for (const r of data) {
    const raw = r[groupBy];
    const key = raw == null ? '' : String(raw).trim();
    if (!key) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(r);
    else groups.set(key, [r]);
  }

  const rows: PivotRow[] = [];
  for (const [key, rowsInGroup] of groups) {
    rows.push({ key, count: rowsInGroup.length, kpis: processKPIs(rowsInGroup) });
  }

  // Sort numerically when every key parses as a finite number, else alphabetically.
  const allNumeric = rows.every(r => Number.isFinite(Number(r.key)));
  rows.sort((a, b) => allNumeric
    ? Number(a.key) - Number(b.key)
    : a.key.localeCompare(b.key));

  return rows;
}
