import { useState, useEffect, useMemo } from 'react';
import { BarChart3, LayoutDashboard, Users, Megaphone, Lightbulb, Table, Menu } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { parseExcelFile } from './utils/excelParser';
import type { PerformanceRecord } from './utils/kpiEngine';
import { Overview } from './pages/Overview';
import { Affiliates } from './pages/Affiliates';
import { Campaigns } from './pages/Campaigns';
import { Insights } from './pages/Insights';
import { Data } from './pages/Data';
import { fetchRecords, clearRecords, insertRecords } from './lib/db';
import type { GlobalFilters, FilterOptions } from './types/filters';

const LS_KEY = 'roi-dashboard-data';

function saveToLocalStorage(records: PerformanceRecord[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(records)); }
  catch (e) { console.warn('localStorage save failed:', e); }
}

function loadFromLocalStorage(): PerformanceRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('localStorage load failed:', e);
    return [];
  }
}

const TABS = [
  { id: 'Overview',   label: 'Overview',   Icon: LayoutDashboard },
  { id: 'Affiliates', label: 'Affiliates',  Icon: Users           },
  { id: 'Campaigns',  label: 'Campaigns',   Icon: Megaphone       },
  { id: 'Insights',   label: 'Insights',    Icon: Lightbulb       },
  { id: 'Data',       label: 'Data',        Icon: Table           },
];

function App() {
  // Initialize directly from localStorage — data is available instantly on refresh
  const [data, setData]               = useState<PerformanceRecord[]>(() => loadFromLocalStorage());
  const [activeTab, setActiveTab]     = useState('Overview');
  const [loading, setLoading]         = useState(false);
  const [isDraggingOver, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters]         = useState<GlobalFilters>({
    searchTerm: '',
    dateRange: { start: '', end: '' },
    selectedBrands: [],
    selectedAMs: [],
    selectedCountries: [],
    selectedSources: [],
    selectedPeriods: [],
  });

  // Sync with Supabase in the background (updates localStorage if DB has newer data)
  useEffect(() => {
    fetchRecords()
      .then(records => {
        if (records.length > 0) {
          setData(records);
          saveToLocalStorage(records);
        }
      })
      .catch(err => console.error('Supabase sync failed (using local data):', err));
  }, []);

  const handleFileUpload = async (file: File) => {
    try {
      setLoading(true);
      const parsedData = await parseExcelFile(file);
      setData(parsedData);
      saveToLocalStorage(parsedData);
      // Supabase sync is best-effort — never block or alert on its failure
      clearRecords()
        .then(() => insertRecords(parsedData))
        .catch((err: unknown) =>
          console.warn('Supabase sync failed, data saved locally:', err)
        );
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Failed to read file. Make sure it is a valid Excel or CSV file.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    try {
      await clearRecords();
    } catch (err) {
      alert(`Failed to clear Supabase data: ${err}`);
      return;
    }
    setData([]);
    saveToLocalStorage([]);
  };

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      alert('Please drop an Excel file (.xlsx, .xls, or .csv)');
      return;
    }
    handleFileUpload(file);
  };

  const filteredData = useMemo(() => {
    let result = data;

    // Text search: affiliate_id or affiliate_name
    if (filters.searchTerm.trim()) {
      const q = filters.searchTerm.trim().toLowerCase();
      result = result.filter(r =>
        String(r.affiliate_id   ?? '').toLowerCase().includes(q) ||
        String(r.affiliate_name ?? '').toLowerCase().includes(q)
      );
    }

    // Date range filter — expects ISO date strings (YYYY-MM-DD); records with no date are excluded when filter is active
    if (filters.dateRange.start) {
      result = result.filter(r => r.date != null && String(r.date) >= filters.dateRange.start);
    }
    if (filters.dateRange.end) {
      result = result.filter(r => r.date != null && String(r.date) <= filters.dateRange.end);
    }

    // Multi-select filters (OR within category, AND between categories)
    if (filters.selectedBrands.length > 0) {
      result = result.filter(r => filters.selectedBrands.includes(String(r.brand ?? '')));
    }
    if (filters.selectedAMs.length > 0) {
      result = result.filter(r => filters.selectedAMs.includes(String(r.am ?? '')));
    }
    if (filters.selectedCountries.length > 0) {
      result = result.filter(r => filters.selectedCountries.includes(String(r.country ?? '')));
    }
    if (filters.selectedSources.length > 0) {
      result = result.filter(r => filters.selectedSources.includes(String(r.source ?? '')));
    }
    if (filters.selectedPeriods.length > 0) {
      result = result.filter(r => filters.selectedPeriods.includes(String(r.period ?? '')));
    }

    return result;
  }, [data, filters]);

  const filterOptions = useMemo<FilterOptions>(() => ({
    brands:    [...new Set(data.map(r => String(r.brand    ?? '')).filter(Boolean))].sort(),
    ams:       [...new Set(data.map(r => String(r.am       ?? '')).filter(Boolean))].sort(),
    countries: [...new Set(data.map(r => String(r.country  ?? '')).filter(Boolean))].sort(),
    sources:   [...new Set(data.map(r => String(r.source   ?? '')).filter(Boolean))].sort(),
    periods:   [...new Set(data.map(r => String(r.period   ?? '')).filter(Boolean))].sort(),
  }), [data]);

  const switchTab = (tab: string) => { setActiveTab(tab); setSidebarOpen(false); };

  return (
    <div className="app-root">

      {/* ── Mobile Top Header ── */}
      <header className="mobile-header">
        <div className="mobile-header__logo">
          <BarChart3 size={18} className="mobile-header__logo-icon" />
          <span>ROI Dashboard</span>
        </div>
        <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
      </header>

      {/* ── Sidebar Overlay (mobile) ── */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        onFileUpload={handleFileUpload}
        onClearData={handleClearData}
        activeTab={activeTab}
        setActiveTab={switchTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        recordCount={data.length}
        filteredCount={filteredData.length}
        filters={filters}
        filterOptions={filterOptions}
        onFiltersChange={setFilters}
      />

      {/* ── Main Content ── */}
      <main
        className="main-content"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDraggingOver && (
          <div className="drop-overlay">
            <div className="drop-overlay__inner">
              <p>Drop your Excel file here</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <div className="spinner" />
            <p>Processing dataset…</p>
          </div>
        )}

        {!loading && data.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">
              <BarChart3 size={34} />
            </div>
            <h2>Ready to analyze</h2>
            <p>
              Upload your affiliate performance data via the sidebar to generate
              instant KPI dashboards and insights.
            </p>
          </div>
        )}

        {!loading && data.length > 0 && (
          <div className="fade-in">
            {activeTab === 'Overview'   && <Overview   data={filteredData} />}
            {activeTab === 'Affiliates' && <Affiliates data={filteredData} />}
            {activeTab === 'Campaigns'  && <Campaigns  data={filteredData} />}
            {activeTab === 'Insights'   && <Insights   data={filteredData} />}
            {activeTab === 'Data'       && <Data       data={filteredData} />}
          </div>
        )}
      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="mobile-bottom-nav">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`mobile-bottom-nav__item${activeTab === id ? ' active' : ''}`}
            onClick={() => switchTab(id)}
          >
            <Icon size={18} />
            <span className="mobile-bottom-nav__label">{label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}

export default App;
