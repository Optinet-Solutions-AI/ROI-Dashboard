import React, { useState, useEffect } from 'react';
import { Trash2, Clock } from 'lucide-react';
import type { PerformanceRecord } from '../utils/kpiEngine';

const PAGE_SIZE = 20;

const formatHeader = (key: string): string =>
  key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

interface DeletedProps {
  data: PerformanceRecord[];
  clearedAt: Date | null;
}

export const Deleted: React.FC<DeletedProps> = ({ data, clearedAt }) => {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => { setPage(0); }, [data, search]);

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">
          <Trash2 size={34} />
        </div>
        <h2>No deleted data</h2>
        <p>When you clear your data, the records will appear here.</p>
      </div>
    );
  }

  const filteredData = data.filter(row => {
    if (!search) return true;
    const q        = search.toLowerCase();
    const affId    = String(row.affiliate_id ?? row.affiliate ?? '').toLowerCase();
    const country  = String(row.country ?? '').toLowerCase();
    const campaign = String(row.campaign ?? row.brand ?? '').toLowerCase();
    return affId.includes(q) || country.includes(q) || campaign.includes(q);
  });

  const rawColumns = Object.keys(data[0]);
  const PRIORITY = ['affiliate_name', 'affiliate_id'];
  const columns = [
    ...PRIORITY.filter(c => rawColumns.includes(c)),
    ...rawColumns.filter(c => !PRIORITY.includes(c)),
  ];

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const start      = safePage * PAGE_SIZE;
  const end        = Math.min(start + PAGE_SIZE, filteredData.length);
  const rows       = filteredData.slice(start, end);

  const formattedTime = clearedAt
    ? clearedAt.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div>
      <div className="header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1>Deleted Data</h1>
          <p>Records removed in this session</p>
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderRadius: 8,
        border: '1px solid rgba(239,68,68,0.35)',
        background: 'rgba(239,68,68,0.08)',
        marginBottom: 20,
        flexWrap: 'wrap',
      }}>
        <Trash2 size={15} style={{ color: '#ef4444', flexShrink: 0 }} />
        <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
          <strong style={{ color: '#ef4444' }}>{data.length.toLocaleString()} records</strong> were cleared.
          Upload a new file from the sidebar to start fresh.
        </span>
        {formattedTime && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            <Clock size={12} />
            Cleared {formattedTime}
          </span>
        )}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search Affiliate ID, Country or Campaign…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            outline: 'none',
            minWidth: 180,
            flex: 1,
            maxWidth: 420,
            fontFamily: 'var(--font-body)',
          }}
        />
      </div>

      <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Showing {filteredData.length === 0 ? 0 : (start + 1).toLocaleString()}–{end.toLocaleString()} of {filteredData.length.toLocaleString()} rows
        {filteredData.length !== data.length && ` (filtered from ${data.length.toLocaleString()})`}
      </div>

      <div className="data-table-container" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col} style={{ whiteSpace: 'nowrap' }}>{formatHeader(col)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={start + idx}
                style={idx % 2 !== 0 ? { backgroundColor: 'rgba(255,255,255,0.03)' } : undefined}
              >
                {columns.map(col => (
                  <td key={col} style={{ whiteSpace: 'nowrap' }}>
                    {row[col] != null ? String(row[col]) : '—'}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>
                  No records match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
        <button
          className="uploader-btn"
          onClick={() => setPage(p => p - 1)}
          disabled={safePage === 0}
          aria-label="Previous page"
          style={{ opacity: safePage === 0 ? 0.4 : 1, cursor: safePage === 0 ? 'not-allowed' : 'pointer' }}
        >
          ← Prev
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Page {safePage + 1} of {totalPages}
        </span>
        <button
          className="uploader-btn"
          onClick={() => setPage(p => p + 1)}
          disabled={safePage >= totalPages - 1}
          aria-label="Next page"
          style={{ opacity: safePage >= totalPages - 1 ? 0.4 : 1, cursor: safePage >= totalPages - 1 ? 'not-allowed' : 'pointer' }}
        >
          Next →
        </button>
      </div>
    </div>
  );
};
