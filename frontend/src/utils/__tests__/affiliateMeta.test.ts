import { describe, it, expect } from 'vitest';
import { affiliateMeta } from '../affiliateMeta';
import type { PerformanceRecord } from '../kpiEngine';

const rows: PerformanceRecord[] = [
  { affiliate_id: '173343', affiliate_name: 'Acme Aff', company_name: 'Acme Ltd', am: 'Gemma',    brand: 'SP', player_country: 'DE', date: '2026-03-01', ftds: 5, revenue: 100 },
  { affiliate_id: '173343', affiliate_name: 'Acme Aff', company_name: 'Acme Ltd', am: 'Gemma',    brand: 'LV', player_country: 'AT', date: '2026-02-01', ftds: 3, revenue: 50  },
  { affiliate_id: '173343', affiliate_name: 'Acme Aff', company_name: 'Acme Ltd', am: 'Charisse', brand: 'SP', player_country: 'DE', date: '2025-11-01', ftds: 4, revenue: 80  },
];

describe('affiliateMeta', () => {
  it('extracts id, name, most-frequent AM, and ordered date range', () => {
    const meta = affiliateMeta(rows);
    expect(meta.id).toBe('173343');
    expect(meta.name).toBe('Acme Aff');
    expect(meta.companyName).toBe('Acme Ltd');
    expect(meta.am).toBe('Gemma'); // 2 rows vs Charisse 1 row
    expect(meta.firstDate).toBe('2025-11-01');
    expect(meta.lastDate).toBe('2026-03-01');
  });

  it('brandMix lists brands with counts, sorted desc by count', () => {
    const meta = affiliateMeta(rows);
    expect(meta.brandMix).toEqual([
      { key: 'SP', count: 2 },
      { key: 'LV', count: 1 },
    ]);
  });

  it('countryMix lists player_countries with counts, sorted desc by count', () => {
    const meta = affiliateMeta(rows);
    expect(meta.countryMix).toEqual([
      { key: 'DE', count: 2 },
      { key: 'AT', count: 1 },
    ]);
  });

  it('returns a null-like shape for an empty record set', () => {
    const meta = affiliateMeta([]);
    expect(meta.id).toBe('');
    expect(meta.name).toBe('');
    expect(meta.companyName).toBe('');
    expect(meta.am).toBe('');
    expect(meta.brandMix).toEqual([]);
    expect(meta.countryMix).toEqual([]);
    expect(meta.firstDate).toBe('');
    expect(meta.lastDate).toBe('');
  });

  it('skips blank brand / country / am / company values when deriving meta', () => {
    const meta = affiliateMeta([
      { affiliate_id: '1', affiliate_name: 'X', company_name: '', am: '',         brand: '',   player_country: undefined, date: '2026-01-01' },
      { affiliate_id: '1', affiliate_name: 'X', company_name: 'X Co', am: 'Andrei', brand: 'SP', player_country: 'FR',      date: '2026-02-01' },
    ]);
    expect(meta.companyName).toBe('X Co');
    expect(meta.am).toBe('Andrei');
    expect(meta.brandMix).toEqual([{ key: 'SP', count: 1 }]);
    expect(meta.countryMix).toEqual([{ key: 'FR', count: 1 }]);
  });

  it('uses String() coercion for affiliate_id so numeric IDs round-trip safely', () => {
    const meta = affiliateMeta([
      { affiliate_id: 12345 as unknown as string, affiliate_name: 'N', date: '2026-01-01' },
    ]);
    expect(meta.id).toBe('12345');
  });
});
