import type { PerformanceRecord } from './kpiEngine';
import type { GlobalFilters, FilterOptions } from '../types/filters';

/**
 * Apply the global filter bar to an in-memory record array.
 * Pure function: same inputs → same output, no side effects.
 * Semantics:
 *   - Empty arrays / empty strings mean "no filter on this dimension".
 *   - Within a dimension, values are OR'd (selectedBrands: ['SP','LV'] = SP or LV).
 *   - Across dimensions, filters are AND'd.
 *   - Date bounds are inclusive and lexicographic on 'YYYY-MM-DD' strings.
 */
export function applyFilters(
  data: PerformanceRecord[],
  f: GlobalFilters,
): PerformanceRecord[] {
  const search = f.searchTerm.trim().toLowerCase();

  return data.filter(r => {
    if (f.selectedPartnerIds.length      && !f.selectedPartnerIds.includes(String(r.affiliate_id ?? '')))            return false;
    if (f.selectedBrands.length          && !f.selectedBrands.includes(String(r.brand ?? '')))                       return false;
    if (f.selectedCompanyNames.length    && !f.selectedCompanyNames.includes(String(r.company_name ?? '')))          return false;
    if (f.selectedAMs.length             && !f.selectedAMs.includes(String(r.am ?? '')))                             return false;
    if (f.selectedSources.length         && !f.selectedSources.includes(String(r.source ?? '')))                     return false;
    if (f.selectedPlayerCountries.length && !f.selectedPlayerCountries.includes(String(r.player_country ?? '')))     return false;
    if (f.selectedPeriods.length         && !f.selectedPeriods.includes(String(r.period ?? '')))                     return false;
    if (f.selectedFtdMonths.length       && !f.selectedFtdMonths.includes(String(r.ftd_month ?? '')))                return false;

    if (f.problematicSource === 'yes' && r.problematic_source !== 1) return false;
    if (f.problematicSource === 'no'  && r.problematic_source === 1) return false;

    if (f.dateFrom && (!r.date || r.date < f.dateFrom)) return false;
    if (f.dateTo   && (!r.date || r.date > f.dateTo))   return false;

    if (search) {
      const hay = [
        r.affiliate_id, r.affiliate_name, r.company_name, r.am, r.brand, r.source, r.campaign,
      ].map(v => String(v ?? '').toLowerCase()).join(' ');
      if (!hay.includes(search)) return false;
    }

    return true;
  });
}

/**
 * Collect the set of distinct non-empty values per filter dimension so the
 * filter bar can populate its dropdowns. Returns values sorted alphabetically
 * (numerically when all values parse as numbers).
 */
export function extractFilterOptions(data: PerformanceRecord[]): FilterOptions {
  const sets: Record<keyof FilterOptions, Set<string>> = {
    partnerIds:      new Set(),
    brands:          new Set(),
    companyNames:    new Set(),
    ams:             new Set(),
    sources:         new Set(),
    playerCountries: new Set(),
    periods:         new Set(),
    ftdMonths:       new Set(),
  };

  for (const r of data) {
    const add = (s: Set<string>, v: unknown) => {
      const str = v == null ? '' : String(v).trim();
      if (str) s.add(str);
    };
    add(sets.partnerIds,      r.affiliate_id);
    add(sets.brands,          r.brand);
    add(sets.companyNames,    r.company_name);
    add(sets.ams,             r.am);
    add(sets.sources,         r.source);
    add(sets.playerCountries, r.player_country);
    add(sets.periods,         r.period);
    add(sets.ftdMonths,       r.ftd_month);
  }

  const sortNumericFriendly = (arr: string[]) => arr.sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });

  return {
    partnerIds:      sortNumericFriendly([...sets.partnerIds]),
    brands:          [...sets.brands].sort(),
    companyNames:    [...sets.companyNames].sort(),
    ams:             [...sets.ams].sort(),
    sources:         [...sets.sources].sort(),
    playerCountries: [...sets.playerCountries].sort(),
    periods:         sortNumericFriendly([...sets.periods]),
    ftdMonths:       [...sets.ftdMonths].sort(),
  };
}
