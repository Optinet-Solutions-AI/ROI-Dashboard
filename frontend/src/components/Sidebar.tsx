import React from 'react';
import {
  UploadCloud, LayoutDashboard, Users, Megaphone,
  Lightbulb, Table, BarChart3, X, Sun, Moon, Trash2, Clock, Sparkles,
  CalendarDays, Globe, Tag, Link,
} from 'lucide-react';
import { useTheme } from '../lib/theme';

interface SidebarProps {
  onFileUpload:  (file: File) => void;
  onClearData?:  () => void;
  activeTab:     string;
  setActiveTab:  (tab: string) => void;
  isOpen:        boolean;
  onClose:       () => void;
  recordCount?:  number;
  filteredCount?: number;
  deletedCount?: number;
}

const TABS = [
  { id: 'Overview',   label: 'Overview',   Icon: LayoutDashboard },
  { id: 'AskAI',      label: 'Ask AI',     Icon: Sparkles        },
  { id: 'ByMonth',    label: 'By Month',   Icon: CalendarDays    },
  { id: 'ByCountry',  label: 'By Country', Icon: Globe           },
  { id: 'ByBrand',    label: 'By Brand',   Icon: Tag             },
  { id: 'BySource',   label: 'By Source',  Icon: Link            },
  { id: 'Affiliates', label: 'Affiliates', Icon: Users           },
  { id: 'Campaigns',  label: 'Campaigns',  Icon: Megaphone       },
  { id: 'Insights',   label: 'Insights',   Icon: Lightbulb       },
  { id: 'Data',       label: 'Raw Data',   Icon: Table           },
];

export const Sidebar: React.FC<SidebarProps> = ({
  onFileUpload, onClearData, activeTab, setActiveTab, isOpen, onClose,
  recordCount = 0, filteredCount = recordCount, deletedCount = 0,
}) => {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

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
            {filteredCount === recordCount
              ? `${recordCount.toLocaleString()} records loaded`
              : `${filteredCount.toLocaleString()} of ${recordCount.toLocaleString()} records`}
          </div>
        )}
      </div>

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

        {deletedCount > 0 && (
          <button
            className={`nav-item${activeTab === 'Deleted' ? ' active' : ''}`}
            onClick={() => setActiveTab('Deleted')}
            style={{ color: activeTab === 'Deleted' ? undefined : '#ef4444', opacity: 0.85 }}
          >
            <Clock size={15} />
            Deleted
            <span style={{
              marginLeft: 'auto',
              fontSize: '0.65rem',
              background: 'rgba(239,68,68,0.15)',
              color: '#ef4444',
              borderRadius: 10,
              padding: '1px 6px',
              fontWeight: 600,
            }}>
              {deletedCount.toLocaleString()}
            </span>
          </button>
        )}

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
              if (!window.confirm('Remove all loaded records? This cannot be undone.')) return;
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
