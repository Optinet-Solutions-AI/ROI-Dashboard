import React, { useState, useEffect } from 'react';
import { Search, X, Download, Filter, ChevronsUpDown, ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [sortCol, setSortCol]         = useState<string | null>('profit');
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('desc');
  const [colSearch, setColSearch]     = useState<Record<string, string>>({});
  const [popoverPos, setPopoverPos]   = useState<{ top: number; left: number; right: number } | null>(null);
  const colVizRef = React.useRef<HTMLDivElement>(null);
  const { axisColor, axisStroke, gridStroke, tooltipStyle } = useChartColors();

  /* ── Close filter popover on outside click ── */
  useEffect(() => {
    if (!openFilterCol) return;
    const clickHandler = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!t.closest('[data-col-filter-pop]') && !t.closest('[data-col-filter-btn]')) {
        setOpenFilterCol(null);
      }
    };
    document.addEventListener('mousedown', clickHandler);
    return () => document.removeEventListener('mousedown', clickHandler);
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

  /* ── Reset to page 1 whenever column filters change ── */
  useEffect(() => { setPage(1); }, [colFilters]);

  /* ── Aggregate per-affiliate totals ── */
  const affMap: Record<string, any> = {};
  data.forEach(d => {
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
  }));

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

    /* ── Sort by user-selected column/direction ── */
    if (sortCol) {
      const isText = TEXT_COLS.includes(sortCol as TextColKey);
      const dir    = sortDir === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        const av = a[sortCol];
        const bv = b[sortCol];
        const aEmpty = av == null || av === '';
        const bEmpty = bv == null || bv === '';
        if (aEmpty && bEmpty) return 0;
        if (aEmpty) return 1;   // empties always at the bottom
        if (bEmpty) return -1;
        const cmp = isText
          ? String(av).localeCompare(String(bv))
          : (Number(av) || 0) - (Number(bv) || 0);
        return cmp * dir;
      });
    }

    return result;
  })();

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PAGE_SIZE;
  const pageData   = filteredData.slice(pageStart, pageStart + PAGE_SIZE);

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

  /* ── Header cell with filter/sort popover ── */
  const Th = ({ col, label, align = 'left' }: { col: string; label: string; align?: 'left' | 'right' }) => {
    const active        = isColActive(col);
    const isOpen        = openFilterCol === col;
    const isText        = TEXT_COLS.includes(col as TextColKey);
    const isSortedHere  = sortCol === col;
    const search        = colSearch[col] || '';

    const sortByCol = (dir: 'asc' | 'desc') => {
      setSortCol(col);
      setSortDir(dir);
      setOpenFilterCol(null);
    };

    const sortBtnStyle: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--text-primary)', fontSize: '0.75rem',
      padding: '5px 4px', borderRadius: 4, textAlign: 'left',
      fontFamily: 'var(--font-body)',
    };

    return (
      <th style={{ position: 'relative', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', gap: 4 }}>
          {label}
          {isSortedHere && (
            sortDir === 'desc'
              ? <ChevronDown size={11} style={{ color: 'var(--accent, #00d4ff)', flexShrink: 0 }} />
              : <ChevronUp   size={11} style={{ color: 'var(--accent, #00d4ff)', flexShrink: 0 }} />
          )}
          <button
            data-col-filter-btn=""
            onClick={e => {
              e.stopPropagation();
              if (openFilterCol === col) {
                setOpenFilterCol(null);
              } else {
                const rect = e.currentTarget.getBoundingClientRect();
                setPopoverPos({
                  top:   rect.bottom + 4,
                  left:  rect.left,
                  right: window.innerWidth - rect.right,
                });
                setOpenFilterCol(col);
              }
            }}
            title={`Filter / sort ${label}`}
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

        {isOpen && popoverPos && (
          <div
            data-col-filter-pop=""
            style={{
              position: 'fixed',
              top:   popoverPos.top,
              left:  align === 'right' ? 'auto' : popoverPos.left,
              right: align === 'right' ? popoverPos.right : 'auto',
              zIndex: 1000,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 12px',
              minWidth: 210,
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

            {/* ── Sort buttons ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 8 }}>
              <button
                onClick={() => sortByCol('desc')}
                style={{
                  ...sortBtnStyle,
                  background: isSortedHere && sortDir === 'desc' ? 'rgba(0,212,255,0.08)' : 'none',
                  color:      isSortedHere && sortDir === 'desc' ? 'var(--accent, #00d4ff)' : 'var(--text-primary)',
                }}
              >
                <ArrowDownWideNarrow size={12} />
                Sort high → low
              </button>
              <button
                onClick={() => sortByCol('asc')}
                style={{
                  ...sortBtnStyle,
                  background: isSortedHere && sortDir === 'asc' ? 'rgba(0,212,255,0.08)' : 'none',
                  color:      isSortedHere && sortDir === 'asc' ? 'var(--accent, #00d4ff)' : 'var(--text-primary)',
                }}
              >
                <ArrowUpNarrowWide size={12} />
                Sort low → high
              </button>
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '6px 0 8px' }} />

            {isText ? (
              <>
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={e => setColSearch(prev => ({ ...prev, [col]: e.target.value }))}
                  autoFocus
                  style={{ ...popInputStyle, marginBottom: 6 }}
                />
                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {(() => {
                    const q       = search.trim().toLowerCase();
                    const matches = getUniqueValues(col as TextColKey).filter(v => !q || v.toLowerCase().includes(q));
                    if (matches.length === 0) {
                      return <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No matches</span>;
                    }
                    return matches.map(val => {
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
                            onChange={() => toggleListItem(col as TextColKey, val)}
                            style={{ accentColor: 'var(--accent, #00d4ff)', width: 13, height: 13, cursor: 'pointer', flexShrink: 0 }}
                          />
                          {val}
                        </label>
                      );
                    });
                  })()}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={(colFilters[col as NumericColKey] as { min: string; max: string }).min}
                  onChange={e => updateRange(col as NumericColKey, 'min', e.target.value)}
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

  /* ── Top 6 affiliates monthly profit line chart (independent of user sort — always profit-desc) ── */
  const top6Ids = [...tableData].sort((a, b) => b.profit - a.profit).slice(0, 6).map(a => a.affiliate_id);

  const monthlyMap: Record<string, Record<string, number>> = {};
  data.forEach(d => {
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
        <div className="chart-title">Net Profit by Affiliate — Top 6</div>

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
                  const color     = LINE_COLORS[idx % LINE_COLORS.length];
                  const isFocused = focusedAffiliate === null || focusedAffiliate === id;
                  const affName   = tableData.find(r => r.affiliate_id === id)?.affiliate_name;
                  const lineName  = affName ? `${affName} (${id})` : id;
                  return (
                    <Line
                      key={id}
                      name={lineName}
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
                const color     = LINE_COLORS[idx % LINE_COLORS.length];
                const isFocused = focusedAffiliate === null || focusedAffiliate === id;
                const affName   = tableData.find(r => r.affiliate_id === id)?.affiliate_name;
                const name      = affName ? `${affName} (${id})` : id;
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

      {/* ── Search bar + clear column filters ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
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

      {/* ── Affiliate Table ── */}
      <div className="data-table-container">
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
                {visibleCols.has('clicks')  && <td>{row.clicks.toLocaleString()}</td>}
                {visibleCols.has('ftds')    && <td>{row.ftds.toLocaleString()}</td>}
                {visibleCols.has('revenue') && <td>{formatter.format(row.revenue)}</td>}
                {visibleCols.has('cost')    && <td>{formatter.format(row.cost)}</td>}
                {visibleCols.has('profit')  && <td style={{ color: row.profit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{formatter.format(row.profit)}</td>}
                {visibleCols.has('roi')     && <td style={{ color: row.roi >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{pctFormatter.format(row.roi)}</td>}
                {visibleCols.has('cpa')     && <td style={{ color: 'var(--text-primary)' }}>{formatter.format(row.cpa)}</td>}
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
              Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredData.length)} of {filteredData.length} affiliates
              {(searchTerm || anyColActive) && tableData.length !== filteredData.length && ` (filtered from ${tableData.length})`}
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
