import { useMemo } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { useFilters } from '../../contexts/FilterContext';
import { extractFilterOptions } from '../../utils/applyFilters';
import { FilterDropdown } from './FilterDropdown';
import { ActiveFilterChips } from './ActiveFilterChips';
import type { PerformanceRecord } from '../../utils/kpiEngine';
import './FilterBar.css';

interface Props { data: PerformanceRecord[]; }

export function FilterBar({ data }: Props) {
  const { filters, updateFilter, reset, activeCount } = useFilters();
  const options = useMemo(() => extractFilterOptions(data), [data]);

  return (
    <div className="filter-bar">
      <div className="filter-bar__row">
        <div className="filter-bar__search">
          <Search size={13} />
          <input
            type="text"
            placeholder="Search partner, company, AM, brand, source…"
            value={filters.searchTerm}
            onChange={e => updateFilter('searchTerm', e.target.value)}
          />
        </div>

        <FilterDropdown label="Partner"  options={options.partnerIds}      selected={filters.selectedPartnerIds}      onChange={v => updateFilter('selectedPartnerIds',      v)} />
        <FilterDropdown label="Brand"    options={options.brands}          selected={filters.selectedBrands}          onChange={v => updateFilter('selectedBrands',          v)} />
        <FilterDropdown label="Company"  options={options.companyNames}    selected={filters.selectedCompanyNames}    onChange={v => updateFilter('selectedCompanyNames',    v)} />
        <FilterDropdown label="AM"       options={options.ams}             selected={filters.selectedAMs}             onChange={v => updateFilter('selectedAMs',             v)} />
        <FilterDropdown label="Source"   options={options.sources}         selected={filters.selectedSources}         onChange={v => updateFilter('selectedSources',         v)} />
        <FilterDropdown label="Country"  options={options.playerCountries} selected={filters.selectedPlayerCountries} onChange={v => updateFilter('selectedPlayerCountries', v)} />
        <FilterDropdown label="Period"   options={options.periods}         selected={filters.selectedPeriods}         onChange={v => updateFilter('selectedPeriods',         v)} />
        <FilterDropdown label="Month"    options={options.ftdMonths}       selected={filters.selectedFtdMonths}       onChange={v => updateFilter('selectedFtdMonths',       v)} />

        <div className="filter-bar__date-range">
          <label>
            From
            <input type="date" value={filters.dateFrom} onChange={e => updateFilter('dateFrom', e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={filters.dateTo} onChange={e => updateFilter('dateTo', e.target.value)} />
          </label>
        </div>

        <label className="filter-bar__problematic">
          Problematic
          <select
            value={filters.problematicSource}
            onChange={e => updateFilter('problematicSource', e.target.value as 'all' | 'yes' | 'no')}
          >
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>

        <button
          type="button"
          className="filter-bar__reset"
          onClick={reset}
          disabled={activeCount === 0}
          aria-label="Reset filters"
        >
          <RotateCcw size={12} />
          Reset{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>

      <ActiveFilterChips filters={filters} update={updateFilter} />
    </div>
  );
}
