import { describe, it, expect } from 'vitest';
import { cohortAggregate } from '../cohortAggregate';
import type { PerformanceRecord } from '../kpiEngine';

const data: PerformanceRecord[] = [
  // cohort 2026-01: periods 0, 1, 2
  { ftd_month: '2026-01', period: 0, revenue: 100, ftds: 5, casino_real_ngr: 60, sb_real_ngr: 0, cost: 40, flats_and_adjustments: 0 },
  { ftd_month: '2026-01', period: 1, revenue: 80,  ftds: 0, casino_real_ngr: 50, sb_real_ngr: 0, cost: 10, flats_and_adjustments: 0 },
  { ftd_month: '2026-01', period: 2, revenue: 40,  ftds: 0, casino_real_ngr: 25, sb_real_ngr: 0, cost: 5,  flats_and_adjustments: 0 },
  // cohort 2026-02: periods 0, 1
  { ftd_month: '2026-02', period: 0, revenue: 200, ftds: 8, casino_real_ngr: 120, sb_real_ngr: 0, cost: 80, flats_and_adjustments: 0 },
  { ftd_month: '2026-02', period: 1, revenue: 150, ftds: 0, casino_real_ngr: 90, sb_real_ngr: 0, cost: 20, flats_and_adjustments: 0 },
];

describe('cohortAggregate', () => {
  it('returns ascending periods and alphabetical cohorts for revenue metric', () => {
    const out = cohortAggregate(data, { metric: 'revenue' });
    expect(out.periods).toEqual([0, 1, 2]);
    expect(out.cohorts).toEqual(['2026-01', '2026-02']);
  });

  it('chartData has one row per period with cohort columns filled where data exists', () => {
    const out = cohortAggregate(data, { metric: 'revenue' });
    expect(out.chartData).toEqual([
      { period: 0, '2026-01': 100, '2026-02': 200 },
      { period: 1, '2026-01': 80,  '2026-02': 150 },
      { period: 2, '2026-01': 40 },   // 2026-02 absent from period 2 → column missing (null-safe for recharts)
    ]);
  });

  it('supports ftds metric', () => {
    const out = cohortAggregate(data, { metric: 'ftds' });
    expect(out.chartData[0]).toEqual({ period: 0, '2026-01': 5, '2026-02': 8 });
  });

  it('supports profit = revenue - cost', () => {
    const out = cohortAggregate(data, { metric: 'profit' });
    expect(out.chartData[0]).toEqual({ period: 0, '2026-01': 60, '2026-02': 120 });
  });

  it('supports ngr = casino_real_ngr + sb_real_ngr', () => {
    const out = cohortAggregate(data, { metric: 'ngr' });
    expect(out.chartData[0]).toEqual({ period: 0, '2026-01': 60, '2026-02': 120 });
  });

  it('coerces period values that arrive as strings', () => {
    const mixed: PerformanceRecord[] = [
      { ftd_month: '2026-01', period: '0' as unknown as number, revenue: 10 },
      { ftd_month: '2026-01', period: '1' as unknown as number, revenue: 5  },
    ];
    const out = cohortAggregate(mixed, { metric: 'revenue' });
    expect(out.periods).toEqual([0, 1]);
    expect(out.chartData[0]).toEqual({ period: 0, '2026-01': 10 });
  });

  it('omits rows with null/empty ftd_month or non-numeric period', () => {
    const dirty: PerformanceRecord[] = [
      ...data,
      { ftd_month: '', period: 0, revenue: 999 },
      { ftd_month: '2026-03', period: 'N/A' as unknown as number, revenue: 999 },
    ];
    const out = cohortAggregate(dirty, { metric: 'revenue' });
    expect(out.cohorts).toEqual(['2026-01', '2026-02']); // 2026-03 row skipped (non-numeric period)
  });

  it('returns empty shape on empty input', () => {
    expect(cohortAggregate([], { metric: 'revenue' })).toEqual({
      periods: [],
      cohorts: [],
      chartData: [],
    });
  });
});
