import { describe, it, expect } from 'vitest';
import { pivotAggregate } from '../pivotAggregate';
import type { PerformanceRecord } from '../kpiEngine';

const data: PerformanceRecord[] = [
  { affiliate_id: '1', brand: 'SP', player_country: 'DE', ftd_month: '2026-03', revenue: 100, cost: 40, ftds: 2, casino_real_ngr: 50, sb_real_ngr: 0, flats_and_adjustments: 0 },
  { affiliate_id: '2', brand: 'SP', player_country: 'AT', ftd_month: '2026-02', revenue: 200, cost: 80, ftds: 3, casino_real_ngr: 120, sb_real_ngr: 0, flats_and_adjustments: 0 },
  { affiliate_id: '3', brand: 'L7', player_country: 'DE', ftd_month: '2026-03', revenue: 300, cost: 100, ftds: 4, casino_real_ngr: 180, sb_real_ngr: 0, flats_and_adjustments: 0 },
];

describe('pivotAggregate', () => {
  it('groups by a categorical dimension and sums metrics per group', () => {
    const rows = pivotAggregate(data, 'brand');
    const byKey = Object.fromEntries(rows.map(r => [r.key, r]));

    expect(rows).toHaveLength(2);
    expect(byKey.SP.count).toBe(2);
    expect(byKey.SP.kpis.revenue).toBe(300);
    expect(byKey.SP.kpis.cost).toBe(120);
    expect(byKey.SP.kpis.ftds).toBe(5);
    expect(byKey.L7.count).toBe(1);
    expect(byKey.L7.kpis.revenue).toBe(300);
  });

  it('computes per-group KPIs via processKPIs (ROI, ARPU, ADPU, ECPA)', () => {
    const rows = pivotAggregate(data, 'brand');
    const sp = rows.find(r => r.key === 'SP')!;
    // SP: revenue=300, cost=120, ftds=5, ngr=170, spend=120, flats=0
    // ROI = 170 / 120 = 1.4166…, ADPU = 300/5 = 60, ARPU = 170/5 = 34, ECPA = 120/5 = 24
    expect(sp.kpis.roi).toBeCloseTo(170 / 120, 4);
    expect(sp.kpis.adpu).toBe(60);
    expect(sp.kpis.arpu).toBe(34);
    expect(sp.kpis.ecpa).toBe(24);
  });

  it('omits rows whose group key is null/undefined/empty', () => {
    const dataWithBlank: PerformanceRecord[] = [
      ...data,
      { affiliate_id: '4', brand: undefined, revenue: 999 },
      { affiliate_id: '5', brand: '', revenue: 999 },
    ];
    const rows = pivotAggregate(dataWithBlank, 'brand');
    expect(rows.map(r => r.key).sort()).toEqual(['L7', 'SP']);
  });

  it('sorts results numerically when all keys parse as numbers, else alphabetically', () => {
    const numericRows = pivotAggregate(
      [
        { affiliate_id: '1', period: 10 } as PerformanceRecord,
        { affiliate_id: '2', period: 2 } as PerformanceRecord,
        { affiliate_id: '3', period: 1 } as PerformanceRecord,
      ],
      'period',
    );
    expect(numericRows.map(r => r.key)).toEqual(['1', '2', '10']);

    const alphaRows = pivotAggregate(data, 'player_country');
    expect(alphaRows.map(r => r.key)).toEqual(['AT', 'DE']);
  });

  it('returns an empty array on empty input', () => {
    expect(pivotAggregate([], 'brand')).toEqual([]);
  });
});
