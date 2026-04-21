/**
 * One source of truth for all dashboard filters.
 * All selections are arrays: an empty array means "no filter on this dim".
 * Dates use ISO 'YYYY-MM-DD' strings; empty string means "no bound".
 */
export interface GlobalFilters {
  searchTerm: string;
  dateFrom: string;                       // '' or 'YYYY-MM-DD'
  dateTo: string;                         // '' or 'YYYY-MM-DD'
  selectedPartnerIds: string[];
  selectedBrands: string[];
  selectedCompanyNames: string[];
  selectedAMs: string[];
  selectedSources: string[];
  selectedPlayerCountries: string[];
  selectedPeriods: string[];
  selectedFtdMonths: string[];
  problematicSource: 'all' | 'yes' | 'no'; // tri-state toggle, default 'all'
}

export const EMPTY_FILTERS: GlobalFilters = {
  searchTerm: '',
  dateFrom: '',
  dateTo: '',
  selectedPartnerIds: [],
  selectedBrands: [],
  selectedCompanyNames: [],
  selectedAMs: [],
  selectedSources: [],
  selectedPlayerCountries: [],
  selectedPeriods: [],
  selectedFtdMonths: [],
  problematicSource: 'all',
};

export interface FilterOptions {
  partnerIds: string[];
  brands: string[];
  companyNames: string[];
  ams: string[];
  sources: string[];
  playerCountries: string[];
  periods: string[];
  ftdMonths: string[];
}
