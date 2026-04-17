import React, { useState } from 'react';
import {
  UploadCloud, LayoutDashboard, Users, Megaphone,
  Lightbulb, Table, BarChart3, X, Sun, Moon,
  Search, ChevronDown, ChevronUp, Trash2,
} from 'lucide-react';
import { useTheme } from '../lib/theme';
import type { GlobalFilters, FilterOptions } from '../types/filters';

interface SidebarProps {
  onFileUpload:     (file: File) => void;
  onClearData?:     () => void;
  activeTab:        string;
  setActiveTab:     (tab: string) => void;
  isOpen:           boolean;
  onClose:          () => void;
  recordCount?:     number;
  filteredCount?:   number;
  filters?:         GlobalFilters;
  filterOptions?:   FilterOptions;
  onFiltersChange?: (filters: GlobalFilters) => void;
}

const TABS = [
  { id: 'Overview',   label: 'Overview',  Icon: LayoutDashboard },
  { id: 'Affiliates', label: 'Affiliates', Icon: Users           },
  { id: 'Campaigns',  label: 'Campaigns',  Icon: Megaphone       },
  { id: 'Insights',   label: 'Insights',   Icon: Lightbulb       },
  { id: 'Data',       label: 'Raw Data',   Icon: Table           },
];

const DEFAULT_FILTERS: GlobalFilters = {
  searchTerm: '',
  dateRange: { start: '', end: '' },
  selectedBrands: [],
  selectedAMs: [],
  selectedCountries: [],
  selectedSources: [],
  selectedPeriods: [],
};

const isFilterActive = (f: GlobalFilters): boolean =>
  f.searchTerm.trim() !== '' ||
  f.dateRange.start !== '' ||
  f.dateRange.end !== '' ||
  f.selectedBrands.length > 0 ||
  f.selectedAMs.length > 0 ||
  f.selectedCountries.length > 0 ||
  f.selectedSources.length > 0 ||
  f.selectedPeriods.length > 0;

const countActiveFilters = (f: GlobalFilters): number => {
  let count = 0;
  if (f.searchTerm.trim() !== '') count++;
  if (f.dateRange.start !== '' || f.dateRange.end !== '') count++;
  if (f.selectedBrands.length > 0) count++;
  if (f.selectedAMs.length > 0) count++;
  if (f.selectedCountries.length > 0) count++;
  if (f.selectedSources.length > 0) count++;
  if (f.selectedPeriods.length > 0) count++;
  return count;
};

const toggleItem = (arr: string[], item: string): string[] =>
  arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

const formatDateYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const Sidebar: React.FC<SidebarProps> = ({
  onFileUpload, onClearData, activeTab, setActiveTab, isOpen, onClose,
  recordCount = 0, filteredCount, filters, filterOptions, onFiltersChange,
}) => {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleDropdown = (key: string) =>
    setOpenDropdown(prev => (prev === key ? null : key));

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      alert('Please drop an Excel file (.xlsx, .xls, or .csv)');
      return;
    }
    onFileUpload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) onFileUpload(e.target.files[0]);
  };

  const update = (patch: Partial<GlobalFilters>) => {
    if (!filters || !onFiltersChange) return;
    onFiltersChange({ ...filters, ...patch });
  };

  const setLast3Months = () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    update({ dateRange: { start: formatDateYMD(start), end: formatDateYMD(end) } });
  };

  // ── Shared inline style fragments ─────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-sm)',
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    padding: '5px 8px',
    fontFamily: 'var(--font-body)',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.62rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 6,
  };

  const dropdownHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-sm)',
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    padding: '5px 8px',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    gap: 6,
  };

  const checkboxRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    cursor: 'pointer',
    borderRadius: 'var(--r-xs)',
    fontSize: '0.78rem',
    color: 'var(--text-primary)',
    userSelect: 'none',
  };

  // ── Multi-select dropdown renderer ────────────────────────────────────────
  const renderDropdown = (
    key: string,
    label: string,
    options: string[],
    selected: string[],
    onToggle: (item: string) => void,
  ) => {
    if (!options || options.length === 0) return null;
    const isOpen = openDropdown === key;
    return (
      <div style={{ marginBottom: 8 }}>
        <button
          style={dropdownHeaderStyle}
          onClick={() => toggleDropdown(key)}
          type="button"
        >
          <span style={{ flex: 1, textAlign: 'left' }}>
            {label}
            {selected.length > 0 && (
              <span style={{ color: 'var(--gold)', marginLeft: 4, fontSize: '0.72rem' }}>
                ({selected.length} selected)
              </span>
            )}
          </span>
          {isOpen
            ? <ChevronUp size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
            : <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
          }
        </button>
        {isOpen && (
          <div style={{
            border: '1px solid var(--border)',
            borderTop: 'none',
            borderRadius: '0 0 var(--r-sm) var(--r-sm)',
            background: 'var(--bg-input)',
            maxHeight: 160,
            overflowY: 'auto',
            scrollbarWidth: 'none',
          }}>
            {options.map(opt => (
              <label key={opt} style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => onToggle(opt)}
                  style={{ accentColor: 'var(--gold)', flexShrink: 0 }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opt}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  const showFilters = filters !== undefined;
  const activeCount = filters ? countActiveFilters(filters) : 0;
  const showRecordCount = filteredCount !== undefined && filteredCount !== recordCount;

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`}>

      <button className="sidebar__close-btn" onClick={onClose} aria-label="Close menu">
        <X size={14} />
      </button>

      {/* Brand */}
      <div className="sidebar__logo">
        <BarChart3 size={20} className="sidebar__logo-icon" />
        <div>
          <div className="sidebar__logo-text">ROI Dashboard</div>
          <span className="sidebar__logo-sub">Affiliate Intelligence</span>
        </div>
      </div>

      {/* Upload */}
      <div className="sidebar__upload-section">
        <span className="sidebar__upload-label">Data Source</span>
        <div className="upload-dropzone" onDragOver={handleDragOver} onDrop={handleDrop}>
          <div className="upload-dropzone__icon">
            <UploadCloud size={24} />
          </div>
          <p className="upload-dropzone__text">
            Drag &amp; drop an Excel or CSV file, or browse below.
          </p>
          <label className="upload-btn">
            <UploadCloud size={12} />
            Browse File
            <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleFileChange} />
          </label>
        </div>

        {recordCount > 0 && (
          <div className="sidebar__data-status">
            <span className="sidebar__data-dot" />
            {recordCount.toLocaleString()} records loaded
          </div>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      {showFilters && filters && onFiltersChange && (
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          maxHeight: 'calc(100vh - 340px)',
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{
              fontSize: '0.62rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}>
              Filters
              {activeCount > 0 && (
                <span style={{
                  marginLeft: 6,
                  background: 'var(--gold)',
                  color: '#000',
                  borderRadius: 99,
                  padding: '1px 6px',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: 0,
                }}>
                  {activeCount} active
                </span>
              )}
            </span>
            {isFilterActive(filters) && (
              <button
                onClick={() => onFiltersChange(DEFAULT_FILTERS)}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-xs)',
                  color: 'var(--text-muted)',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  fontFamily: 'var(--font-body)',
                }}
                type="button"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Search */}
          <div style={{ marginBottom: 10 }}>
            <span style={labelStyle}>Search Affiliate</span>
            <div style={{ position: 'relative' }}>
              <Search
                size={12}
                style={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Name or Partner ID…"
                value={filters.searchTerm}
                onChange={e => update({ searchTerm: e.target.value })}
                style={{ ...inputStyle, paddingLeft: 26, paddingRight: filters.searchTerm ? 26 : 8 }}
              />
              {filters.searchTerm && (
                <button
                  onClick={() => update({ searchTerm: '' })}
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  type="button"
                  aria-label="Clear search"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Date Range */}
          <div style={{ marginBottom: 10 }}>
            <span style={labelStyle}>Date Range</span>
            <div style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
              <input
                type="date"
                value={filters.dateRange.start}
                onChange={e => update({ dateRange: { ...filters.dateRange, start: e.target.value } })}
                style={{ ...inputStyle, flex: 1, minWidth: 0 }}
              />
              <input
                type="date"
                value={filters.dateRange.end}
                onChange={e => update({ dateRange: { ...filters.dateRange, end: e.target.value } })}
                style={{ ...inputStyle, flex: 1, minWidth: 0 }}
              />
            </div>
            <button
              onClick={setLast3Months}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xs)',
                color: 'var(--text-secondary)',
                fontSize: '0.68rem',
                cursor: 'pointer',
                padding: '3px 8px',
                fontFamily: 'var(--font-body)',
                width: '100%',
              }}
              type="button"
            >
              Last 3 Months
            </button>
          </div>

          {/* Multi-select dropdowns */}
          {renderDropdown(
            'brands', 'Brand',
            filterOptions?.brands ?? [],
            filters.selectedBrands,
            item => update({ selectedBrands: toggleItem(filters.selectedBrands, item) }),
          )}
          {renderDropdown(
            'ams', 'AM',
            filterOptions?.ams ?? [],
            filters.selectedAMs,
            item => update({ selectedAMs: toggleItem(filters.selectedAMs, item) }),
          )}
          {renderDropdown(
            'countries', 'Country',
            filterOptions?.countries ?? [],
            filters.selectedCountries,
            item => update({ selectedCountries: toggleItem(filters.selectedCountries, item) }),
          )}
          {renderDropdown(
            'sources', 'Source',
            filterOptions?.sources ?? [],
            filters.selectedSources,
            item => update({ selectedSources: toggleItem(filters.selectedSources, item) }),
          )}
          {renderDropdown(
            'periods', 'Period',
            filterOptions?.periods ?? [],
            filters.selectedPeriods,
            item => update({ selectedPeriods: toggleItem(filters.selectedPeriods, item) }),
          )}

          {/* Filtered record count */}
          {showRecordCount && (
            <div style={{
              marginTop: 6,
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}>
              Showing {(filteredCount ?? 0).toLocaleString()} of {recordCount.toLocaleString()} records
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar__nav">
        <div className="sidebar__nav-label">Navigation</div>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}

        {/* Theme toggle */}
        <div className="sidebar__nav-label" style={{ marginTop: 16 }}>Appearance</div>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          {isLight ? <Sun size={14} /> : <Moon size={14} />}
          {isLight ? 'Light Mode' : 'Dark Mode'}
          <div className={`theme-toggle__track${isLight ? ' on' : ''}`}>
            <div className="theme-toggle__thumb" />
          </div>
        </button>
      </nav>

      {/* Clear Data */}
      {onClearData && recordCount > 0 && (
        <div style={{ padding: '10px 16px' }}>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('Clear all data from Supabase?')) return;
              onClearData();
            }}
            style={{
              width: '100%',
              background: 'none',
              border: '1px solid #ef4444',
              borderRadius: 'var(--r-xs)',
              color: '#ef4444',
              fontSize: '0.72rem',
              cursor: 'pointer',
              padding: '5px 8px',
              fontFamily: 'var(--font-body)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Trash2 size={12} />
            Clear Data
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="sidebar__footer">
        <span>ROI Dashboard</span>
        <span>v1.0</span>
      </div>

    </aside>
  );
};
