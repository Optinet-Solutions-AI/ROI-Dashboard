import { describe, it, expect } from 'vitest';
import { applyFilters, extractFilterOptions } from '../applyFilters';
import { EMPTY_FILTERS } from '../../types/filters';
import type { PerformanceRecord } from '../kpiEngine';

const data: PerformanceRecord[] = [
  { affiliate_id: '1', brand: 'SP',  am: 'Gemma',    source: 'FP', player_country: 'DE', period: 0, date: '2026-03-01', ftd_month: '2026-03', company_name: 'Acme', problematic_source: 0, revenue: 100 },
  { affiliate_id: '2', brand: 'L7',  am: 'Charisse', source: 'L7', player_country: 'AT', period: 1, date: '2026-02-01', ftd_month: '2026-02', company_name: 'Beta', problematic_source: 1, revenue: 200 },
  { affiliate_id: '3', brand: 'LV',  am: 'Gemma',    source: 'RO', player_country: 'DE', period: 2, date: '2026-01-01', ftd_month: '2026-01', company_name: 'Acme', problematic_source: 0, revenue: 300 },
];

describe('applyFilters', () => {
  it('returns everything when filters are empty', () => {
    expect(applyFilters(data, EMPTY_FILTERS)).toHaveLength(3);
  });

  it('filters by selected brands (OR within dimension)', () => {
    const out = applyFilters(data, { ...EMPTY_FILTERS, selectedBrands: ['SP', 'LV'] });
    expect(out.map(r => r.affiliate_id)).toEqual(['1', '3']);
  });

  it('intersects across dimensions (AND between dimensions)', () => {
    const out = applyFilters(data, {
      ...EMPTY_FILTERS,
      selectedBrands:          ['SP', 'LV'],
      selectedPlayerCountries: ['DE'],
      selectedAMs:             ['Gemma'],
    });
    expect(out.map(r => r.affiliate_id)).toEqual(['1', '3']);
  });

  it('applies date_from/date_to inclusive bounds', () => {
    const out = applyFilters(data, { ...EMPTY_FILTERS, dateFrom: '2026-02-01', dateTo: '2026-03-01' });
    expect(out.map(r => r.affiliate_id)).toEqual(['1', '2']);
  });

  it('tri-state problematicSource: yes keeps only 1, no keeps only 0, all keeps both', () => {
    expect(applyFilters(data, { ...EMPTY_FILTERS, problematicSource: 'yes' })
      .map(r => r.affiliate_id)).toEqual(['2']);
    expect(applyFilters(data, { ...EMPTY_FILTERS, problematicSource: 'no' })
      .map(r => r.affiliate_id)).toEqual(['1', '3']);
    expect(applyFilters(data, { ...EMPTY_FILTERS, problematicSource: 'all' })).toHaveLength(3);
  });

  it('searchTerm matches affiliate_id, company_name, or am (case-insensitive)', () => {
    const out = applyFilters(data, { ...EMPTY_FILTERS, searchTerm: 'acme' });
    expect(out.map(r => r.affiliate_id)).toEqual(['1', '3']);
  });

  it('coerces period to string for comparison', () => {
    const out = applyFilters(data, { ...EMPTY_FILTERS, selectedPeriods: ['1', '2'] });
    expect(out.map(r => r.affiliate_id)).toEqual(['2', '3']);
  });
});

describe('extractFilterOptions', () => {
  it('returns sorted unique values per dimension', () => {
    const opts = extractFilterOptions(data);
    expect(opts.brands).toEqual(['L7', 'LV', 'SP']);
    expect(opts.ams).toEqual(['Charisse', 'Gemma']);
    expect(opts.playerCountries).toEqual(['AT', 'DE']);
    expect(opts.periods).toEqual(['0', '1', '2']);
    expect(opts.ftdMonths).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('omits null/undefined/empty values', () => {
    const opts = extractFilterOptions([
      ...data,
      { affiliate_id: '4', brand: '', am: undefined, source: null as unknown as string },
    ]);
    expect(opts.brands).toEqual(['L7', 'LV', 'SP']);
    expect(opts.ams).toEqual(['Charisse', 'Gemma']);
  });
});
