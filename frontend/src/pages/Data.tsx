import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Filter } from 'lucide-react';
import type { PerformanceRecord } from '../utils/kpiEngine';

const PAGE_SIZE = 20;

const formatHeader = (key: string): string =>
  key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const popInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 5,
  color: 'var(--text-primary)',
  fontSize: '0.78rem',
  outline: 'none',
  fontFamily: 'var(--font-body)',
  boxSizing: 'border-box',
};

type ColFilters = Record<string, string[] | { min: string; max: string }>;

function isNumericCol(data: PerformanceRecord[], col: string): boolean {
  const vals = data.slice(0, 50).map(r => r[col]).filter(v => v != null && v !== '');
  if (vals.length === 0) return false;
  const numCount = vals.filter(v => !isNaN(Number(v))).length;
  return numCount / vals.length >= 0.8;
}

export const Data: React.FC<{ data: PerformanceRecord[] }> = ({ data }) => {
  const [page, setPage]               = useState(0);
  const [search, setSearch]           = useState('');
  const [colFilters, setColFilters]   = useState<ColFilters>({});
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);

  const rawColumns = data.length > 0 ? Object.keys(data[0]) : [];
  const PRIORITY = ['affiliate_name', 'affiliate_id'];
  const columns = [
    ...PRIORITY.filter(c => rawColumns.includes(c)),
    ...rawColumns.filter(c => !PRIORITY.includes(c)),
  ];

  const numericCols = useMemo(
    () => new Set(columns.filter(col => isNumericCol(data, col))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );

  /* ── Reset on new data ── */
  useEffect(() => {
    setColFilters({});
    setPage(0);
    setSearch('');
  }, [data]);

  /* ── Reset page on filter change ── */
  useEffect(() => { setPage(0); }, [search, colFilters]);

  /* ── Close popover on outside click ── */
  useEffect(() => {
    if (!openFilterCol) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!t.closest('[data-col-filter-pop]') && !t.closest('[data-col-filter-btn]')) {
        setOpenFilterCol(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openFilterCol]);

  /* ── Filter helpers ── */
  const isColActive = (col: string): boolean => {
    const f = colFilters[col];
    if (!f) return false;
    if (Array.isArray(f)) return f.length > 0;
    return f.min !== '' || f.max !== '';
  };

  const clearCol = (col: string) =>
    setColFilters(prev => ({
      ...prev,
      [col]: numericCols.has(col) ? { min: '', max: '' } : [],
    }));

  const anyColActive = columns.some(c => isColActive(c));

  const toggleListItem = (col: string, val: string) =>
    setColFilters(prev => {
      const arr = (prev[col] as string[] | undefined) ?? [];
      return { ...prev, [col]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] };
    });

  const updateRange = (col: string, field: 'min' | 'max', val: string) =>
    setColFilters(prev => {
      const existing = (prev[col] as { min: string; max: string } | undefined) ?? { min: '', max: '' };
      return { ...prev, [col]: { ...existing, [field]: val } };
    });

  const getUniqueValues = (col: string): string[] =>
    Array.from(new Set(data.map(r => String(r[col] ?? '')).filter(Boolean))).sort();

  /* ── Filtered data ── */
  const searchFiltered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(row => {
      const affId    = String(row.affiliate_id ?? row.affiliate ?? '').toLowerCase();
      const country  = String(row.country ?? '').toLowerCase();
      const campaign = String(row.campaign ?? row.brand ?? '').toLowerCase();
      return affId.includes(q) || country.includes(q) || campaign.includes(q);
    });
  }, [data, search]);

  const filteredData = useMemo(() => {
    let result = searchFiltered;
    for (const col of columns) {
      const f = colFilters[col];
      if (!f) continue;
      if (Array.isArray(f)) {
        if (f.length > 0) result = result.filter(r => f.includes(String(r[col] ?? '')));
      } else {
        const min = parseFloat(f.min);
        const max = parseFloat(f.max);
        if (!isNaN(min)) result = result.filter(r => Number(r[col]) >= min);
        if (!isNaN(max)) result = result.filter(r => Number(r[col]) <= max);
      }
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFiltered, colFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const start      = safePage * PAGE_SIZE;
  const end        = Math.min(start + PAGE_SIZE, filteredData.length);
  const rows       = filteredData.slice(start, end);

  /* ── Header cell with filter popover ── */
  const Th = ({ col }: { col: string }) => {
    const active    = isColActive(col);
    const isOpen    = openFilterCol === col;
    const isNumeric = numericCols.has(col);
    const filterVal = colFilters[col];

    return (
      <th style={{ position: 'relative', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {formatHeader(col)}
          <button
            data-col-filter-btn=""
            onClick={e => { e.stopPropagation(); setOpenFilterCol(prev => prev === col ? null : col); }}
            title={`Filter ${formatHeader(col)}`}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '1px 3px',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              color: active ? 'var(--gold, #f0b429)' : 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <Filter size={10} strokeWidth={active ? 2.5 : 1.8} />
          </button>
        </div>

        {isOpen && (
          <div
            data-col-filter-pop=""
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              zIndex: 300,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 12px',
              minWidth: 190,
              boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                {formatHeader(col)}
              </span>
              {active && (
                <button
                  onClick={() => clearCol(col)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.65rem', padding: '1px 4px', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 3 }}
                >
                  <X size={10} /> Clear
                </button>
              )}
            </div>

            {isNumeric ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={(filterVal as { min: string; max: string } | undefined)?.min ?? ''}
                  onChange={e => updateRange(col, 'min', e.target.value)}
                  autoFocus
                  style={{ ...popInputStyle, width: '50%' }}
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={(filterVal as { min: string; max: string } | undefined)?.max ?? ''}
                  onChange={e => updateRange(col, 'max', e.target.value)}
                  style={{ ...popInputStyle, width: '50%' }}
                />
              </div>
            ) : (
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {getUniqueValues(col).map(val => {
                  const checked = ((filterVal as string[] | undefined) ?? []).includes(val);
                  return (
                    <label
                      key={val}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 2px', cursor: 'pointer', fontSize: '0.8rem',
                        color: checked ? 'var(--text-primary)' : 'var(--text-muted)',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          toggleListItem(col, val);
                          setOpenFilterCol(null);
                        }}
                        style={{ accentColor: 'var(--accent, #00d4ff)', width: 13, height: 13, cursor: 'pointer', flexShrink: 0 }}
                      />
                      {val}
                    </label>
                  );
                })}
                {getUniqueValues(col).length === 0 && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No values</span>
                )}
              </div>
            )}
          </div>
        )}
      </th>
    );
  };

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <h2 style={{ fontSize: '2rem', marginBottom: '16px' }}>No data to display</h2>
        <p style={{ color: '#ffffff', maxWidth: '400px', textAlign: 'center' }}>
          Upload an Excel file from the sidebar to view raw records here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="header">
        <h1>Data</h1>
        <p>Raw records from uploaded file</p>
      </div>

      {/* ── Search + clear filters ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
          />
          <input
            type="text"
            placeholder="Search Affiliate ID, Country or Campaign…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 32px 8px 32px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', padding: 0,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {anyColActive && (
          <button
            onClick={() => setColFilters({})}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8,
              border: '1px solid var(--gold, #f0b429)',
              background: 'none', color: 'var(--gold, #f0b429)',
              fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}
          >
            <X size={12} /> Clear column filters
          </button>
        )}

        {(search || anyColActive) && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {filteredData.length.toLocaleString()} result{filteredData.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div style={{ marginBottom: '12px', color: '#ffffff', fontSize: '0.875rem' }}>
        Showing {filteredData.length === 0 ? 0 : (start + 1).toLocaleString()}–{end.toLocaleString()} of {filteredData.length.toLocaleString()} rows
        {filteredData.length !== data.length && ` (filtered from ${data.length.toLocaleString()})`}
      </div>

      <div className="data-table-container" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              {columns.map(col => (
                <Th key={col} col={col} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={start + idx}
                style={idx % 2 !== 0 ? { backgroundColor: 'rgba(255,255,255,0.03)' } : undefined}
              >
                <td style={{ color: 'var(--gold, #f0b429)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', width: 40 }}>
                  {String(start + idx + 1).padStart(2, '0')}
                </td>
                {columns.map(col => (
                  <td key={col} style={{ whiteSpace: 'nowrap' }}>
                    {row[col] != null ? String(row[col]) : '—'}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', color: '#ffffff', padding: '32px 0' }}>
                  No records match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
        <button
          className="uploader-btn"
          onClick={() => setPage(p => p - 1)}
          disabled={safePage === 0}
          aria-label="Previous page"
          style={{ opacity: safePage === 0 ? 0.4 : 1, cursor: safePage === 0 ? 'not-allowed' : 'pointer' }}
        >
          ← Prev
        </button>
        <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>
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
