import React from 'react';
import { Euro, CreditCard, TrendingUp, Percent, UserCheck, Target, Activity, Sliders, Gift, ArrowDownCircle, Users, BarChart2, Download } from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { type PerformanceRecord, processKPIs } from '../utils/kpiEngine';
import { downloadCSV } from '../utils/exportUtils';
import { useChartColors } from '../lib/theme';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';

const COLORS = [
  '#00d4ff', '#818cf8', '#10b981', '#f0b429', '#ef4444', '#ec4899',
  '#f97316', '#a78bfa', '#34d399', '#fbbf24', '#6366f1',
];

export const Overview: React.FC<{ data: PerformanceRecord[] }> = ({ data }) => {
  const kpis = processKPIs(data);
  const { axisColor, axisStroke, tooltipStyle } = useChartColors();

  const handleExport = () => {
    const rows = data.map(r => ({ ...r }));
    downloadCSV(rows, 'roi-overview-export.csv');
  };

  const formatEur = (value: number) => `€${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value)}`;
  const pct = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

  /* Time-series aggregation */
  const timeMap: Record<string, { date: string; revenue: number; cost: number; profit: number }> = {};
  data.forEach(d => {
    if (!d.date) return;
    if (!timeMap[d.date]) timeMap[d.date] = { date: d.date, revenue: 0, cost: 0, profit: 0 };
    timeMap[d.date].revenue += Number(d.revenue) || 0;
    timeMap[d.date].cost    += Number(d.cost)    || 0;
    timeMap[d.date].profit  += (Number(d.revenue) || 0) - (Number(d.cost) || 0);
  });
  const timeData = Object.values(timeMap).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  /* Top affiliates by profit */
  const affMap: Record<string, { name: string; profit: number }> = {};
  data.forEach(d => {
    if (!d.affiliate_id) return;
    if (!affMap[d.affiliate_id]) affMap[d.affiliate_id] = { name: '', profit: 0 };
    if (d.affiliate_name && !affMap[d.affiliate_id].name) affMap[d.affiliate_id].name = d.affiliate_name;
    affMap[d.affiliate_id].profit += (Number(d.revenue) || 0) - (Number(d.cost) || 0);
  });
  const topAffiliates = Object.keys(affMap)
    .map(key => ({
      affiliate_id:   key,
      affiliate_name: affMap[key].name,
      label:          affMap[key].name ? `${affMap[key].name} (${key})` : key,
      profit:         affMap[key].profit,
    }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);

  /* Revenue by country */
  const countryMap: Record<string, number> = {};
  data.forEach(d => {
    if (!d.country) return;
    countryMap[d.country] = (countryMap[d.country] || 0) + (Number(d.revenue) || 0);
  });
  const countryData = Object.keys(countryMap)
    .map(key => ({ name: key, value: countryMap[key] }))
    .sort((a, b) => b.value - a.value);

  return (
    <div>
      <div className="header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1>Overview</h1>
          <p>Key Performance Indicators</p>
        </div>
        <button
          onClick={handleExport}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* ── Financial Metrics ── */}
      <div className="kpi-group-label">Financial</div>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KPICard label="FTD"            value={kpis.ftds.toLocaleString()}            color="#ec4899" icon={<UserCheck     size={15} />} />
        <KPICard label="Deposits Sum"   value={formatEur(kpis.revenue)}              color="#00d4ff" icon={<Euro          size={15} />} />
        <KPICard label="Casino NGR"     value={formatEur(kpis.casino_real_ngr)}      color="#10b981" icon={<TrendingUp    size={15} />} />
        <KPICard label="SB NGR"         value={formatEur(kpis.sb_real_ngr)}          color="#34d399" icon={<Activity      size={15} />} />
        <KPICard label="Partner Income" value={formatEur(kpis.cost)}                 color="#f0b429" icon={<CreditCard    size={15} />} />
        <KPICard label="Flats & Adj."   value={formatEur(kpis.flats_and_adjustments)} color="#818cf8" icon={<Sliders     size={15} />} />
      </div>

      {/* ── Performance Ratios ── */}
      <div className="kpi-group-label">Performance</div>
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KPICard label="ROI"       value={kpis.roi.toFixed(1)}          color="#818cf8" icon={<Percent         size={15} />} />
        <KPICard label="% Bonus"   value={pct.format(kpis.bonus_pct)}   color="#f97316" icon={<Gift            size={15} />} />
        <KPICard label="% Cashout" value={pct.format(kpis.cashout_pct)} color="#ef4444" icon={<ArrowDownCircle size={15} />} />
        <KPICard label="ADPU"      value={formatEur(kpis.adpu)}        color="#00d4ff" icon={<Users           size={15} />} />
        <KPICard label="ARPU"      value={formatEur(kpis.arpu)}        color="#10b981" icon={<BarChart2       size={15} />} />
        <KPICard label="ECPA"      value={formatEur(kpis.ecpa)}        color="#f97316" icon={<Target          size={15} />} />
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <div className="chart-title">Performance Over Time</div>
          <ResponsiveContainer width="100%" height={310}>
            <AreaChart data={timeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gRev"    x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gCost"   x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f0b429" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#f0b429" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="date"  stroke={axisStroke} tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis                 stroke={axisStroke} tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="revenue" stroke="#00d4ff" strokeWidth={1.5} fillOpacity={1} fill="url(#gRev)"    />
              <Area type="monotone" dataKey="cost"    stroke="#f0b429" strokeWidth={1.5} fillOpacity={1} fill="url(#gCost)"   />
              <Area type="monotone" dataKey="profit"  stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#gProfit)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">Deposits Sum by Country</div>
          <div className="scroll-hidden" style={{ maxHeight: 340, overflowY: 'auto' }}>
            <ResponsiveContainer width="100%" height={Math.max(countryData.length * 22, 200)}>
              <BarChart
                data={countryData}
                layout="vertical"
                margin={{ top: 2, right: 60, bottom: 2, left: 0 }}
                barSize={12}
              >
                <XAxis
                  type="number"
                  stroke={axisStroke}
                  tick={{ fontSize: 9, fill: axisColor }}
                  tickFormatter={(v) => v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(0)}M` : v >= 1_000 ? `€${(v / 1_000).toFixed(0)}k` : `€${v}`}
                  width={50}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke={axisStroke}
                  tick={{ fontSize: 9, fill: axisColor }}
                  width={28}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                  itemStyle={{ color: '#ffffff' }}
                  formatter={(value) => [`€${Number(value ?? 0).toLocaleString()}`, 'Deposits Sum']}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {countryData.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="chart-card" style={{ marginTop: 16 }}>
        <div className="chart-title">Top 10 Affiliates by Profit</div>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={topAffiliates}
            layout="vertical"
            margin={{ top: 4, right: 20, bottom: 4, left: 4 }}
            barSize={14}
          >
            <XAxis
              type="number"
              stroke={axisStroke}
              tick={{ fontSize: 11, fill: axisColor }}
              tickFormatter={(v) => v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `€${(v / 1_000).toFixed(0)}k` : `€${v}`}
            />
            <YAxis
              type="category"
              dataKey="label"
              stroke={axisStroke}
              tick={{ fontSize: 11, fill: axisColor }}
              width={160}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#111827', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
              formatter={(value) => [`€${Number(value ?? 0).toLocaleString()}`, 'Profit']}
            />
            <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
              {topAffiliates.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.profit >= 0 ? '#00d4ff' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
