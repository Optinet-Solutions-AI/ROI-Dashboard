import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { EMPTY_FILTERS } from '../types/filters';
import type { GlobalFilters } from '../types/filters';

interface FilterContextValue {
  filters: GlobalFilters;
  setFilters: (next: GlobalFilters) => void;
  updateFilter: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void;
  reset: () => void;
  activeCount: number;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<GlobalFilters>(EMPTY_FILTERS);

  const updateFilter = useCallback(<K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.searchTerm.trim())             n++;
    if (filters.dateFrom || filters.dateTo)    n++;
    if (filters.selectedPartnerIds.length)     n++;
    if (filters.selectedBrands.length)         n++;
    if (filters.selectedCompanyNames.length)   n++;
    if (filters.selectedAMs.length)            n++;
    if (filters.selectedSources.length)        n++;
    if (filters.selectedPlayerCountries.length) n++;
    if (filters.selectedPeriods.length)        n++;
    if (filters.selectedFtdMonths.length)      n++;
    if (filters.problematicSource !== 'all')   n++;
    return n;
  }, [filters]);

  const value = useMemo(
    () => ({ filters, setFilters, updateFilter, reset, activeCount }),
    [filters, updateFilter, reset, activeCount],
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used inside <FilterProvider>');
  return ctx;
}
