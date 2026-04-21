import { X } from 'lucide-react';
import type { GlobalFilters } from '../../types/filters';

interface Props {
  filters: GlobalFilters;
  update: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void;
}

interface Chip { label: string; onClear: () => void; }

export function ActiveFilterChips({ filters, update }: Props) {
  const chips: Chip[] = [];

  const arrayChip = <K extends keyof GlobalFilters>(
    label: string,
    key: K,
    values: string[],
  ) => {
    if (values.length === 0) return;
    chips.push({
      label: `${label}: ${values.length === 1 ? values[0] : `${values.length} selected`}`,
      onClear: () => update(key, [] as unknown as GlobalFilters[K]),
    });
  };

  arrayChip('Partner',  'selectedPartnerIds',      filters.selectedPartnerIds);
  arrayChip('Brand',    'selectedBrands',          filters.selectedBrands);
  arrayChip('Company',  'selectedCompanyNames',    filters.selectedCompanyNames);
  arrayChip('AM',       'selectedAMs',             filters.selectedAMs);
  arrayChip('Source',   'selectedSources',         filters.selectedSources);
  arrayChip('Country',  'selectedPlayerCountries', filters.selectedPlayerCountries);
  arrayChip('Period',   'selectedPeriods',         filters.selectedPeriods);
  arrayChip('Month',    'selectedFtdMonths',       filters.selectedFtdMonths);

  if (filters.dateFrom || filters.dateTo) {
    chips.push({
      label: `Date: ${filters.dateFrom || '…'} → ${filters.dateTo || '…'}`,
      onClear: () => { update('dateFrom', ''); update('dateTo', ''); },
    });
  }

  if (filters.problematicSource !== 'all') {
    chips.push({
      label: `Problematic: ${filters.problematicSource}`,
      onClear: () => update('problematicSource', 'all'),
    });
  }

  if (filters.searchTerm.trim()) {
    chips.push({
      label: `Search: "${filters.searchTerm}"`,
      onClear: () => update('searchTerm', ''),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="filter-chips">
      {chips.map((c, i) => (
        <button key={i} type="button" className="filter-chip" onClick={c.onClear}>
          <span>{c.label}</span>
          <X size={11} />
        </button>
      ))}
    </div>
  );
}
