import { useState, useEffect } from 'react';
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
  { id: 'Affiliates', label: 'Affiliates',  Icon: Users           },
  { id: 'Campaigns',  label: 'Campaigns',   Icon: Megaphone       },
  { id: 'Insights',   label: 'Insights',    Icon: Lightbulb       },
  { id: 'Data',       label: 'Data',        Icon: Table           },
];

function App() {
  const [data, setData]               = useState<PerformanceRecord[]>([]);
  const [activeTab, setActiveTab]     = useState('Overview');
  const [loading, setLoading]         = useState(true); // true until IDB load completes
  const [isDraggingOver, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // On mount: load from IndexedDB first; fall back to Supabase only when IDB is empty
  useEffect(() => {
    // Request persistent storage so the browser won't evict IDB data under pressure
    navigator.storage?.persist?.().catch(() => { /* not supported in all browsers */ });

    (async () => {
      try {
        const local = await loadFromIDB();
        if (local.length > 0) { setData(local); return; }
        // IDB empty — try Supabase as a one-time fallback (first visit / cleared storage)
        const remote = await fetchRecords().catch(() => [] as PerformanceRecord[]);
        if (remote.length > 0) {
          setData(remote);
          saveToIDB(remote).catch(e => console.warn('IDB save failed:', e));
        }
      } catch (e) {
        console.error('Failed to load persisted data:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleFileUpload = async (file: File) => {
    setLoading(true);

    // Step 1: Parse the file — report errors clearly
    let parsedData: PerformanceRecord[];
    try {
      parsedData = await parseExcelFile(file);
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Failed to read file. Make sure it is a valid Excel or CSV file.');
      setLoading(false);
      return;
    }

    // Step 2: Update the UI immediately
    setData(parsedData);

    // Step 3: Kick off Supabase cloud sync now — runs regardless of IDB outcome
    clearRecords()
      .then(() => insertRecords(parsedData))
      .catch((err: unknown) =>
        console.warn('Supabase sync failed, data saved locally:', err)
      );

    // Step 4: Persist to IndexedDB for instant reload on next visit
    try {
      await saveToIDB(parsedData);
    } catch (idbError) {
      console.error('IDB save failed — data is in memory and syncing to cloud:', idbError);
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = () => {
    setData([]);
    clearIDB().catch(e => console.warn('IDB clear failed:', e));
    clearRecords().catch(e => console.warn('Supabase clear failed (local cleared):', e));
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
            {activeTab === 'Overview'   && <Overview   data={data} />}
            {activeTab === 'Affiliates' && <Affiliates data={data} />}
            {activeTab === 'Campaigns'  && <Campaigns  data={data} />}
            {activeTab === 'Insights'   && <Insights   data={data} />}
            {activeTab === 'Data'       && <Data       data={data} />}
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
