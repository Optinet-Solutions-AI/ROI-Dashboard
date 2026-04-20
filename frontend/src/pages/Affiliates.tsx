import React, { useState, useEffect } from 'react';
import { Search, X, Download, Filter, ChevronsUpDown } from 'lucide-react';
import type { PerformanceRecord } from '../utils/kpiEngine';
import { downloadCSV } from '../utils/exportUtils';
import { useChartColors } from '../lib/theme';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { ReferenceLine } from 'recharts';

const PAGE_SIZE = 20;
const LINE_COLORS = ['#00d4ff', '#f0b429', '#10b981', '#ec4899', '#818cf8', '#f97316'];

type TextColKey    = 'affiliate_name' | 'affiliate_id';
type NumericColKey = 'clicks' | 'ftds' | 'revenue' | 'cost' | 'profit' | 'roi' | 'cpa';
type ColumnFilters = Record<TextColKey, string[]> & Record<NumericColKey, { min: string; max: string }>;

const TEXT_COLS: TextColKey[] = ['affiliate_name', 'affiliate_id'];

const DEFAULT_COL_FILTERS: ColumnFilters = {
  affiliate_name: [],
  affiliate_id:   [],
  clicks:  { min: '', max: '' },
  ftds:    { min: '', max: '' },
  revenue: { min: '', max: '' },
  cost:    { min: '', max: '' },
  profit:  { min: '', max: '' },
  roi:     { min: '', max: '' },
  cpa:     { min: '', max: '' },
};

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

export const Affiliates: React.FC<{ data: PerformanceRecord[] }> = ({ data }) => {
  const ALL_COLS: { key: string; label: string }[] = [
    { key: 'affiliate_name', label: 'Affiliate Name' },
    { key: 'affiliate_id',   label: 'Affiliate ID'   },
    { key: 'clicks',         label: 'Clicks'         },
    { key: 'ftds',           label: 'FTDs'           },
    { key: 'revenue',        label: 'Revenue'        },
    { key: 'cost',           label: 'Cost'           },
    { key: 'profit',         label: 'Profit'         },
    { key: 'roi',            label: 'ROI'            },
    { key: 'cpa',            label: 'CPA'            },
  ];

  const [page, setPage]               = useState(1);
  const [searchTerm, setSearchTerm]   = useState('');
  const [colFilters, setColFilters]   = useState<ColumnFilters>(DEFAULT_COL_FILTERS);
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => new Set(ALL_COLS.map(c => c.key)));
  const [colVizOpen, setColVizOpen]   = useState(false);
  const [focusedAffiliate, setFocusedAffiliate] = useState<string | null>(null);
  const [sortState, setSortState] = useState<{ col: string | null; dir: 'asc' | 'desc' | null }>({ col: null, dir: null });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const colVizRef = React.useRef<HTMLDivElement>(null);
  const { axisColor, axisStroke, gridStroke, tooltipStyle } = useChartColors();

  /* ── Close filter popover on outside click ── */
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

  /* ── Close column-visibility popup on outside click ── */
  useEffect(() => {
    if (!colVizOpen) return;
    const handler = (e: MouseEvent) => {
      if (colVizRef.current && !colVizRef.current.contains(e.target as Node)) {
        setColVizOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colVizOpen]);

  /* ── Reset to page 1 whenever column filters or sort changes ── */
  useEffect(() => { setPage(1); }, [colFilters, sortState]);

  /* ── Date range filter ── */
  const allMonths = Array.from(new Set(
    data.filter(d => d.date).map(d => String(d.date).slice(0, 7))
  )).sort();
  const minMonth = allMonths[0] || '';
  const maxMonth = allMonths[allMonths.length - 1] || '';

  const dateFilteredData = (dateFrom || dateTo)
    ? data.filter(d => {
        const m = d.date ? String(d.date).slice(0, 7) : '';
        if (!m) return true;
        if (dateFrom && m < dateFrom) return false;
        if (dateTo   && m > dateTo)   return false;
        return true;
      })
    : data;

  /* ── Aggregate per-affiliate totals ── */
  const affMap: Record<string, any> = {};
  dateFilteredData.forEach(d => {
    if (!d.affiliate_id && !d.affiliate) return;
    const aff = d.affiliate_id || d.affiliate;
    if (!affMap[aff]) affMap[aff] = { affiliate_id: aff, affiliate_name: d.affiliate_name ?? '', clicks: 0, ftds: 0, revenue: 0, cost: 0, profit: 0 };
    if (d.affiliate_name && !affMap[aff].affiliate_name) affMap[aff].affiliate_name = d.affiliate_name;
    affMap[aff].clicks  += Number(d.clicks)  || 0;
    affMap[aff].ftds    += Number(d.ftds)    || 0;
    affMap[aff].revenue += Number(d.revenue) || 0;
    affMap[aff].cost    += Number(d.cost)    || 0;
    affMap[aff].profit  += (Number(d.revenue) || 0) - (Number(d.cost) || 0);
  });

  const tableData = Object.values(affMap).map(row => ({
    ...row,
    roi: row.cost > 0 ? row.profit / row.cost : 0,
    cpa: row.ftds > 0 ? row.cost / row.ftds : 0,
  })).sort((a, b) => b.profit - a.profit);

  /* ── Search filter ── */
  const searchFiltered = searchTerm.trim() === ''
    ? tableData
    : tableData.filter(row => {
        const q = searchTerm.toLowerCase();
        return (
          String(row.affiliate_id   ?? '').toLowerCase().includes(q) ||
          String(row.affiliate_name ?? '').toLowerCase().includes(q)
        );
      });

  const handleSearch = (term: string) => { setSearchTerm(term); setPage(1); };

  /* ── Column filters ── */
  const filteredData = (() => {
    let result = searchFiltered;

    if (colFilters.affiliate_name.length > 0) {
      result = result.filter(r => colFilters.affiliate_name.includes(String(r.affiliate_name ?? '')));
    }
    if (colFilters.affiliate_id.length > 0) {
      result = result.filter(r => colFilters.affiliate_id.includes(String(r.affiliate_id ?? '')));
    }

    const applyRange = (field: string, range: { min: string; max: string }, transform?: (v: number) => number) => {
      const min = parseFloat(range.min);
      const max = parseFloat(range.max);
      if (!isNaN(min)) result = result.filter(r => (transform ? transform(r[field]) : r[field]) >= min);
      if (!isNaN(max)) result = result.filter(r => (transform ? transform(r[field]) : r[field]) <= max);
    };

    applyRange('clicks',  colFilters.clicks);
    applyRange('ftds',    colFilters.ftds);
    applyRange('revenue', colFilters.revenue);
    applyRange('cost',    colFilters.cost);
    applyRange('profit',  colFilters.profit);
    applyRange('roi',     colFilters.roi, v => v * 100); // stored as ratio, filter as %
    applyRange('cpa',     colFilters.cpa);

    return result;
  })();

  const handleSort = (col: string) => {
    setSortState(prev => {
      if (prev.col !== col) return { col, dir: 'asc' };
      if (prev.dir === 'asc') return { col, dir: 'desc' };
      return { col: null, dir: null };
    });
  };

  const sortedData = (() => {
    if (!sortState.col || !sortState.dir) return filteredData;
    const col = sortState.col;
    return [...filteredData].sort((a, b) => {
      const av = a[col] ?? 0;
      const bv = b[col] ?? 0;
      if (typeof av === 'string') return sortState.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      return sortState.dir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  })();

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PAGE_SIZE;
  const pageData   = sortedData.slice(pageStart, pageStart + PAGE_SIZE);

  /* ── Column filter helpers ── */
  const isColActive = (col: string): boolean => {
    if (TEXT_COLS.includes(col as TextColKey)) {
      return (colFilters[col as TextColKey] as string[]).length > 0;
    }
    const r = colFilters[col as NumericColKey] as { min: string; max: string };
    return r.min !== '' || r.max !== '';
  };

  const clearCol = (col: string) =>
    setColFilters(prev => ({
      ...prev,
      [col]: TEXT_COLS.includes(col as TextColKey) ? [] : { min: '', max: '' },
    }));

  const anyColActive = Object.keys(DEFAULT_COL_FILTERS).some(c => isColActive(c));

  const toggleListItem = (col: TextColKey, val: string) =>
    setColFilters(prev => {
      const arr = prev[col] as string[];
      return {
        ...prev,
        [col]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val],
      };
    });

  const updateRange = (col: NumericColKey, field: 'min' | 'max', val: string) =>
    setColFilters(prev => ({
      ...prev,
      [col]: { ...(prev[col] as { min: string; max: string }), [field]: val },
    }));

  const getUniqueValues = (col: TextColKey): string[] =>
    Array.from(new Set(tableData.map(r => String(r[col] ?? '')).filter(Boolean))).sort();

  /* ── Header cell with filter popover ── */
  const Th = ({ col, label, align = 'left' }: { col: string; label: string; align?: 'left' | 'right' }) => {
    const active = isColActive(col);
    const isOpen = openFilterCol === col;
    const isText = TEXT_COLS.includes(col as TextColKey);
    const sortDir = sortState.col === col ? sortState.dir : null;

    return (
      <th style={{ position: 'relative', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', gap: 4 }}>
          <span
            onClick={() => handleSort(col)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, userSelect: 'none' }}
          >
            {label}
            <span style={{ fontSize: '0.65rem', color: sortDir ? 'var(--accent, #00d4ff)' : 'var(--text-muted)', opacity: sortDir ? 1 : 0.4, lineHeight: 1 }}>
              {sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : '↕'}
            </span>
          </span>
          <button
            data-col-filter-btn=""
            onClick={e => { e.stopPropagation(); setOpenFilterCol(prev => prev === col ? null : col); }}
            title={`Filter ${label}`}
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
              left: align === 'right' ? 'auto' : 0,
              right: align === 'right' ? 0 : 'auto',
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
                {label}{col === 'roi' ? ' (%)' : ''}
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

            {isText ? (
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {getUniqueValues(col as TextColKey).map(val => {
                  const checked = (colFilters[col as TextColKey] as string[]).includes(val);
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
                          toggleListItem(col as TextColKey, val);
                          setOpenFilterCol(null);
                        }}
                        style={{ accentColor: 'var(--accent, #00d4ff)', width: 13, height: 13, cursor: 'pointer', flexShrink: 0 }}
                      />
                      {val}
                    </label>
                  );
                })}
                {getUniqueValues(col as TextColKey).length === 0 && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No values</span>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={(colFilters[col as NumericColKey] as { min: string; max: string }).min}
                  onChange={e => updateRange(col as NumericColKey, 'min', e.target.value)}
                  autoFocus
                  style={{ ...popInputStyle, width: '50%' }}
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={(colFilters[col as NumericColKey] as { min: string; max: string }).max}
                  onChange={e => updateRange(col as NumericColKey, 'max', e.target.value)}
                  style={{ ...popInputStyle, width: '50%' }}
                />
              </div>
            )}
          </div>
        )}
      </th>
    );
  };

  /* ── Top 6 affiliates monthly profit line chart ── */
  const top6Ids = filteredData.slice(0, 6).map(a => a.affiliate_id);

  const monthlyMap: Record<string, Record<string, number>> = {};
  dateFilteredData.forEach(d => {
    const aff = d.affiliate_id || d.affiliate;
    if (!aff || !d.date || !top6Ids.includes(aff)) return;
    const raw = String(d.date);
    const monthKey = raw.length >= 7 ? raw.slice(0, 7) : raw;
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = {};
    const profit = (Number(d.revenue) || 0) - (Number(d.cost) || 0);
    monthlyMap[monthKey][aff] = (monthlyMap[monthKey][aff] || 0) + profit;
  });

  const lineData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, vals]) => {
      let label = monthKey;
      try {
        label = new Date(monthKey + '-02').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      } catch {}
      return { month: label, ...vals };
    });

  const formatter    = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const pctFormatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

  const handleExport = () => {
    const rows = tableData.map(row => ({
      'Affiliate ID':   row.affiliate_id,
      'Affiliate Name': row.affiliate_name || '',
      'Clicks':         row.clicks,
      'FTDs':           row.ftds,
      'Revenue':        row.revenue,
      'Cost':           row.cost,
      'Profit':         row.profit,
      'ROI (%)':        (row.roi * 100).toFixed(2),
      'CPA':            row.cpa.toFixed(2),
    }));
    downloadCSV(rows, 'roi-affiliates-export.csv');
  };

  const pageButtons = (() => {
    const btns: (number | '…')[] = [];
    const delta = 2;
    const left  = Math.max(1, safePage - delta);
    const right = Math.min(totalPages, safePage + delta);
    if (left > 1)           { btns.push(1); if (left > 2) btns.push('…'); }
    for (let i = left; i <= right; i++) btns.push(i);
    if (right < totalPages) { if (right < totalPages - 1) btns.push('…'); btns.push(totalPages); }
    return btns;
  })();

  return (
    <div>
      <div className="header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1>Affiliates</h1>
          <p>Detailed Affiliate Performance</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleExport}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)',
              fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Net Profit by Affiliate (line chart) ── */}
      <div className="chart-card" style={{ marginBottom: 20, minHeight: lineData.length > 1 ? 360 : 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
          <div className="chart-title" style={{ margin: 0 }}>Net Profit by Affiliate — Top 6</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="month"
              value={dateFrom}
              min={minMonth}
              max={dateTo || maxMonth}
              onChange={e => setDateFrom(e.target.value)}
              style={{
                padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--bg-input)', color: '#fff', colorScheme: 'dark',
                fontSize: '0.78rem', fontFamily: 'var(--font-body)', outline: 'none', cursor: 'pointer',
              }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>–</span>
            <input
              type="month"
              value={dateTo}
              min={dateFrom || minMonth}
              max={maxMonth}
              onChange={e => setDateTo(e.target.value)}
              style={{
                padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--bg-input)', color: '#fff', colorScheme: 'dark',
                fontSize: '0.78rem', fontFamily: 'var(--font-body)', outline: 'none', cursor: 'pointer',
              }}
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                title="Clear date filter"
                style={{
                  display: 'flex', alignItems: 'center', padding: '5px 8px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {lineData.length > 1 ? (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineData} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" opacity={0.5} />
                <XAxis
                  dataKey="month"
                  stroke={axisStroke}
                  tick={{ fontSize: 11, fill: axisColor }}
                  tickLine={false}
                />
                <YAxis
                  stroke={axisStroke}
                  tick={{ fontSize: 11, fill: axisColor }}
                  tickFormatter={(v) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v / 1_000).toFixed(0)}k` : `$${v}`}
                  width={60}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any, name: any) => [formatter.format(Number(value ?? 0)), String(name)]}
                />
                <ReferenceLine y={0} stroke={axisStroke} strokeDasharray="6 3" strokeWidth={1} />
                {top6Ids.map((id, idx) => {
                  const color = LINE_COLORS[idx % LINE_COLORS.length];
                  const isFocused = focusedAffiliate === null || focusedAffiliate === id;
                  return (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={id}
                      stroke={color}
                      strokeWidth={focusedAffiliate === id ? 3 : 2}
                      strokeOpacity={isFocused ? 1 : 0.12}
                      dot={{ r: 4, strokeWidth: 0, fill: color, fillOpacity: isFocused ? 1 : 0.12 }}
                      activeDot={isFocused ? { r: 6, strokeWidth: 2, stroke: '#ffffff' } : false}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>

            {/* Clickable custom legend */}
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 4, paddingTop: 10 }}>
              {top6Ids.map((id, idx) => {
                const color = LINE_COLORS[idx % LINE_COLORS.length];
                const isFocused = focusedAffiliate === null || focusedAffiliate === id;
                const name = tableData.find(r => r.affiliate_id === id)?.affiliate_name || id;
                return (
                  <button
                    key={id}
                    onClick={() => setFocusedAffiliate(prev => prev === id ? null : id)}
                    title={focusedAffiliate === id ? 'Click to show all' : `Focus on ${name}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: focusedAffiliate === id ? `${color}18` : 'none',
                      border: focusedAffiliate === id ? `1px solid ${color}55` : '1px solid transparent',
                      borderRadius: 20,
                      cursor: 'pointer',
                      padding: '4px 10px',
                      opacity: isFocused ? 1 : 0.35,
                      transition: 'opacity 0.2s, background 0.2s, border-color 0.2s',
                      fontSize: '0.75rem',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    <span style={{
                      width: 9, height: 9, borderRadius: '50%',
                      background: color, flexShrink: 0,
                      boxShadow: focusedAffiliate === id ? `0 0 7px ${color}` : 'none',
                      transition: 'box-shadow 0.2s',
                    }} />
                    {name}
                  </button>
                );
              })}
              {focusedAffiliate !== null && (
                <button
                  onClick={() => setFocusedAffiliate(null)}
                  style={{
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 20, cursor: 'pointer',
                    padding: '4px 10px', fontSize: '0.72rem',
                    color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
                    transition: 'color 0.2s',
                  }}
                >
                  Show all
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: '24px 0', color: axisColor, fontSize: '0.875rem', textAlign: 'center' }}>
            {lineData.length === 0
              ? 'No time-series data available.'
              : 'Only one time period detected — upload multi-month data to see trend lines.'}
          </div>
        )}
      </div>

      {/* ── Search bar + column visibility + clear column filters ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: axisColor, pointerEvents: 'none' }}
          />
          <input
            type="text"
            placeholder="Search by affiliate name or ID…"
            value={searchTerm}
            onChange={e => handleSearch(e.target.value)}
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
          {searchTerm && (
            <button
              onClick={() => handleSearch('')}
              aria-label="Clear search"
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: axisColor,
                display: 'flex', alignItems: 'center', padding: 0,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Column visibility toggle */}
          <div ref={colVizRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setColVizOpen(v => !v)}
              title="Show / hide columns"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                borderRadius: 8, border: `1px solid ${colVizOpen ? 'var(--accent, #00d4ff)' : 'var(--border)'}`,
                backgroundColor: 'var(--bg-card)', color: colVizOpen ? 'var(--accent, #00d4ff)' : 'var(--text-primary)',
                fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
            >
              <ChevronsUpDown size={14} />
              Columns
            </button>

            {colVizOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 400,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 14px', minWidth: 200,
                boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
              }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
                  Visible Columns
                </div>
                {ALL_COLS.map(({ key, label }) => (
                  <label
                    key={key}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0', fontSize: '0.82rem', color: 'var(--text-primary)', userSelect: 'none' }}
                  >
                    <input
                      type="checkbox"
                      checked={visibleCols.has(key)}
                      onChange={() => {
                        setVisibleCols(prev => {
                          const next = new Set(prev);
                          if (next.has(key)) { if (next.size > 1) next.delete(key); }
                          else next.add(key);
                          return next;
                        });
                      }}
                      style={{ accentColor: 'var(--accent, #00d4ff)', width: 14, height: 14, cursor: 'pointer' }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {anyColActive && (
            <button
              onClick={() => setColFilters(DEFAULT_COL_FILTERS)}
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

          {(searchTerm || anyColActive) && (
            <span style={{ fontSize: '0.8rem', color: axisColor }}>
              {filteredData.length} result{filteredData.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Affiliate Table ── */}
      <div className="data-table-container" style={{ minHeight: 500 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              {visibleCols.has('affiliate_name') && <Th col="affiliate_name" label="Affiliate Name" />}
              {visibleCols.has('affiliate_id')   && <Th col="affiliate_id"   label="Affiliate ID"   />}
              {visibleCols.has('clicks')  && <Th col="clicks"  label="Clicks"  align="right" />}
              {visibleCols.has('ftds')    && <Th col="ftds"    label="FTDs"    align="right" />}
              {visibleCols.has('revenue') && <Th col="revenue" label="Revenue" align="right" />}
              {visibleCols.has('cost')    && <Th col="cost"    label="Cost"    align="right" />}
              {visibleCols.has('profit')  && <Th col="profit"  label="Profit"  align="right" />}
              {visibleCols.has('roi')     && <Th col="roi"     label="ROI"     align="right" />}
              {visibleCols.has('cpa')     && <Th col="cpa"     label="CPA"     align="right" />}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, idx) => (
              <tr key={idx}>
                <td style={{ color: axisColor, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  {String(pageStart + idx + 1).padStart(2, '0')}
                </td>
                {visibleCols.has('affiliate_name') && <td style={{ fontWeight: 500 }}>{row.affiliate_name || '—'}</td>}
                {visibleCols.has('affiliate_id')   && <td style={{ fontWeight: 500 }}>{row.affiliate_id}</td>}
                {visibleCols.has('clicks')  && <td style={{ textAlign: 'right' }}>{row.clicks.toLocaleString()}</td>}
                {visibleCols.has('ftds')    && <td style={{ textAlign: 'right' }}>{row.ftds.toLocaleString()}</td>}
                {visibleCols.has('revenue') && <td style={{ textAlign: 'right' }}>{formatter.format(row.revenue)}</td>}
                {visibleCols.has('cost')    && <td style={{ textAlign: 'right' }}>{formatter.format(row.cost)}</td>}
                {visibleCols.has('profit')  && <td style={{ textAlign: 'right', color: row.profit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{formatter.format(row.profit)}</td>}
                {visibleCols.has('roi')     && <td style={{ textAlign: 'right', color: row.roi >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{pctFormatter.format(row.roi)}</td>}
                {visibleCols.has('cpa')     && <td style={{ textAlign: 'right', color: 'var(--text-primary)' }}>{formatter.format(row.cpa)}</td>}
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={1 + visibleCols.size} style={{ textAlign: 'center', color: axisColor, padding: '32px 0' }}>
                  {searchTerm || anyColActive
                    ? 'No affiliates match the current filters.'
                    : 'No affiliate data found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination__info">
              Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, sortedData.length)} of {sortedData.length} affiliates
              {(searchTerm || anyColActive) && tableData.length !== sortedData.length && ` (filtered from ${tableData.length})`}
            </span>
            <div className="pagination__controls">
              <button className="pagination__btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>
                ‹ Prev
              </button>
              {pageButtons.map((btn, i) =>
                btn === '…'
                  ? <span key={`el-${i}`} style={{ color: 'var(--text-muted)', padding: '0 4px' }}>…</span>
                  : <button
                      key={btn}
                      className={`pagination__btn${safePage === btn ? ' active' : ''}`}
                      onClick={() => setPage(btn as number)}
                    >{btn}</button>
              )}
              <button className="pagination__btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
