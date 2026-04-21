import { useState, useEffect, useMemo } from 'react';
import { BarChart3, LayoutDashboard, Users, Megaphone, Lightbulb, Table, Menu, Trash2, Sparkles, CalendarDays, Globe, Tag, Link, Layers } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { parseExcelFile } from './utils/excelParser';
import type { PerformanceRecord } from './utils/kpiEngine';
import { Overview } from './pages/Overview';
import { Affiliates } from './pages/Affiliates';
import { AffiliateProfile } from './pages/AffiliateProfile';
import { Campaigns } from './pages/Campaigns';
import { Insights } from './pages/Insights';
import { Data } from './pages/Data';
import { Deleted } from './pages/Deleted';
import { AskAI } from './pages/AskAI';
import { ByMonth } from './pages/ByMonth';
import { ByCountry } from './pages/ByCountry';
import { ByBrand } from './pages/ByBrand';
import { BySource } from './pages/BySource';
import { Cohort } from './pages/Cohort';
import { fetchRecords, replaceRecords, clearRecords } from './lib/db';
import { FilterProvider, useFilters } from './contexts/FilterContext';
import { FilterBar } from './components/FilterBar/FilterBar';
import { applyFilters } from './utils/applyFilters';

// ── IndexedDB persistence (no size limit — localStorage tops out at ~5 MB) ──
const IDB_NAME    = 'roi-dashboard-db';
const IDB_STORE   = 'records';
const IDB_VERSION = 1;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE))
        req.result.createObjectStore(IDB_STORE, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function saveToIDB(records: PerformanceRecord[]): Promise<void> {
  const db = await openIDB();

  // Step 1: wipe existing data in its own transaction
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error ?? new Error('IDB clear failed'));
    tx.onabort    = () => reject(new Error('IDB clear aborted'));
  });

  // Step 2: insert in batches of 2 000 so no single transaction is too large
  const BATCH = 2000;
  for (let i = 0; i < records.length; i += BATCH) {
    const slice = records.slice(i, i + BATCH);
    await new Promise<void>((resolve, reject) => {
      const tx    = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      for (const r of slice) store.add(r);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error ?? new Error('IDB write failed'));
      tx.onabort    = () => reject(new Error('IDB write aborted'));
    });
  }
}

async function loadFromIDB(): Promise<PerformanceRecord[]> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(req.result as PerformanceRecord[]);
    req.onerror   = () => reject(req.error);
  });
}

async function clearIDB(): Promise<void> {
  const db = await openIDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

const TABS = [
  { id: 'Overview',   label: 'Overview',   Icon: LayoutDashboard },
  { id: 'AskAI',      label: 'Ask AI',     Icon: Sparkles        },
  { id: 'ByMonth',    label: 'By Month',   Icon: CalendarDays    },
  { id: 'ByCountry',  label: 'By Country', Icon: Globe           },
  { id: 'ByBrand',    label: 'By Brand',   Icon: Tag             },
  { id: 'BySource',   label: 'By Source',  Icon: Link            },
  { id: 'Cohort',     label: 'Cohort',     Icon: Layers          },
  { id: 'Affiliates', label: 'Affiliates', Icon: Users           },
  { id: 'Campaigns',  label: 'Campaigns',  Icon: Megaphone       },
  { id: 'Insights',   label: 'Insights',   Icon: Lightbulb       },
  { id: 'Data',       label: 'Data',       Icon: Table           },
  { id: 'Deleted',    label: 'Deleted',    Icon: Trash2          },
];

function App() {
  return (
    <FilterProvider>
      <AppShell />
    </FilterProvider>
  );
}

function AppShell() {
  const [data, setData]               = useState<PerformanceRecord[]>([]);
  const [deletedData, setDeletedData] = useState<PerformanceRecord[]>([]);
  const [deletedAt, setDeletedAt]     = useState<Date | null>(null);
  const [activeTab, setActiveTab]     = useState('Overview');
  const [loading, setLoading]         = useState(true);
  const [isDraggingOver, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  const { filters } = useFilters();
  const filteredData = useMemo(() => applyFilters(data, filters), [data, filters]);

  useEffect(() => {
    navigator.storage?.persist?.().catch(() => { /* not supported in all browsers */ });
    (async () => {
      try {
        const remote = await fetchRecords();
        setData(remote);
        saveToIDB(remote).catch(e => console.warn('IDB cache save failed:', e));
      } catch (err) {
        console.warn('Supabase fetch failed — falling back to local cache:', err);
        try {
          const local = await loadFromIDB();
          if (local.length > 0) setData(local);
        } catch (idbErr) {
          console.error('Both Supabase and IDB failed:', idbErr);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    let parsedData: PerformanceRecord[];
    try {
      parsedData = await parseExcelFile(file);
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Failed to read file. Make sure it is a valid Excel or CSV file.');
      setLoading(false);
      return;
    }
    try {
      await replaceRecords(parsedData);
    } catch (err) {
      console.error('Supabase sync failed:', err);
      alert(
        'Failed to save data to the cloud. Check your internet connection and try again.\n\n' +
        'Your existing data has not been modified.'
      );
      setLoading(false);
      return;
    }
    setData(parsedData);
    try {
      await saveToIDB(parsedData);
    } catch (idbError) {
      console.warn('IDB cache save failed (data is safely in the cloud):', idbError);
    }
    setLoading(false);
  };

  const handleClearData = async () => {
    try {
      await clearRecords();
    } catch (err) {
      console.error('Supabase clear failed:', err);
      alert('Failed to clear cloud data. Check your internet connection and try again.');
      return;
    }
    setDeletedData(data);
    setDeletedAt(new Date());
    setData([]);
    setActiveTab('Deleted');
    clearIDB().catch(e => console.warn('IDB cache clear failed:', e));
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

  const openAffiliateProfile = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    setSidebarOpen(false);
  };

  const closeAffiliateProfile = () => {
    setSelectedPartnerId(null);
  };

  const switchTab = (tab: string) => {
    setSelectedPartnerId(null);
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  return (
    <div className="app-root">
      <header className="mobile-header">
        <div className="mobile-header__logo">
          <BarChart3 size={18} className="mobile-header__logo-icon" />
          <span>ROI Dashboard</span>
        </div>
        <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
      </header>

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
        deletedCount={deletedData.length}
      />

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

        {!loading && activeTab === 'AskAI' && (
          <div className="fade-in"><AskAI /></div>
        )}

        {!loading && data.length === 0 && activeTab !== 'Deleted' && activeTab !== 'AskAI' && (
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

        {!loading && activeTab === 'Deleted' && (
          <div className="fade-in">
            <Deleted data={deletedData} clearedAt={deletedAt} />
          </div>
        )}

        {!loading && data.length > 0 && activeTab !== 'Deleted' && activeTab !== 'AskAI' && (
          <div className="fade-in">
            <FilterBar data={data} />
            {activeTab === 'Overview'   && <Overview   data={filteredData} />}
            {activeTab === 'ByMonth'    && <ByMonth    data={filteredData} />}
            {activeTab === 'ByCountry'  && <ByCountry  data={filteredData} />}
            {activeTab === 'ByBrand'    && <ByBrand    data={filteredData} />}
            {activeTab === 'BySource'   && <BySource   data={filteredData} />}
            {activeTab === 'Cohort'     && <Cohort     data={filteredData} />}
            {activeTab === 'Affiliates' && <Affiliates data={filteredData} onPartnerClick={openAffiliateProfile} />}
            {activeTab === 'Campaigns'  && <Campaigns  data={filteredData} />}
            {activeTab === 'Insights'   && <Insights   data={filteredData} />}
            {activeTab === 'Data'       && <Data       data={filteredData} />}
          </div>
        )}
      </main>

      <nav className="mobile-bottom-nav">
        {TABS.filter(({ id }) => id !== 'Deleted' || deletedData.length > 0).map(({ id, label, Icon }) => (
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

      {selectedPartnerId && (
        <>
          <div className="affiliate-drawer-backdrop" onClick={closeAffiliateProfile} />
          <div className="affiliate-drawer">
            <AffiliateProfile
              partnerId={selectedPartnerId}
              data={filteredData}
              onBack={closeAffiliateProfile}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
