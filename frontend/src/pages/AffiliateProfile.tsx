import React, { useMemo } from 'react';
import { Euro, CreditCard, TrendingUp, Percent, UserCheck, Target, Activity, Sliders, Gift, ArrowDownCircle, Users, BarChart2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { KPICard } from '../components/KPICard';
import { AffiliateHeader } from '../components/AffiliateHeader';
import { NoMatchingRows } from '../components/NoMatchingRows';
import { PivotTable } from '../components/PivotView/PivotTable';
import { processKPIs, type PerformanceRecord } from '../utils/kpiEngine';
import { affiliateMeta } from '../utils/affiliateMeta';
import { pivotAggregate } from '../utils/pivotAggregate';
import { useChartColors } from '../lib/theme';

interface Props {
  partnerId: string;
  data: PerformanceRecord[];            // already filtered by the global FilterBar
  onBack: () => void;
}

const formatEur = (v: number) =>
  `€${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v)}`;

const pct = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

export const AffiliateProfile: React.FC<Props> = ({ partnerId, data, onBack }) => {
  const { axisColor, axisStroke, tooltipStyle } = useChartColors();

  const scoped = useMemo(
    () => data.filter(r => String(r.affiliate_id ?? '') === partnerId),
    [data, partnerId],
  );

  const meta = useMemo(() => affiliateMeta(scoped), [scoped]);
  const kpis = useMemo(() => processKPIs(scoped), [scoped]);

  const byMonth   = useMemo(() => pivotAggregate(scoped, 'ftd_month'),      [scoped]);
  const byBrand   = useMemo(() => pivotAggregate(scoped, 'brand'),          [scoped]);
  const byCountry = useMemo(() => pivotAggregate(scoped, 'player_country'), [scoped]);

  const timeData = useMemo(() => byMonth.map(r => ({
    date:    r.key,
    revenue: r.kpis.revenue,
    cost:    r.kpis.cost,
    profit:  r.kpis.profit,
  })), [byMonth]);

  if (scoped.length === 0) {
    return (
      <div>
        <AffiliateHeader meta={{ ...meta, id: partnerId }} onBack={onBack} />
        <NoMatchingRows entity="rows for this partner" />
      </div>
    );
  }

  return (
    <div>
      <AffiliateHeader meta={meta} onBack={onBack} />

      <div className="kpi-group-label">Financial</div>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KPICard label="FTD"            value={kpis.ftds.toLocaleString()}            color="#ec4899" icon={<UserCheck     size={15} />} />
        <KPICard label="Deposits Sum"   value={formatEur(kpis.revenue)}              color="#00d4ff" icon={<Euro          size={15} />} />
        <KPICard label="Casino NGR"     value={formatEur(kpis.casino_real_ngr)}      color="#10b981" icon={<TrendingUp    size={15} />} />
        <KPICard label="SB NGR"         value={formatEur(kpis.sb_real_ngr)}          color="#34d399" icon={<Activity      size={15} />} />
        <KPICard label="Partner Income" value={formatEur(kpis.cost)}                 color="#f0b429" icon={<CreditCard    size={15} />} />
        <KPICard label="Flats & Adj."   value={formatEur(kpis.flats_and_adjustments)} color="#818cf8" icon={<Sliders     size={15} />} />
      </div>

      <div className="kpi-group-label">Performance</div>
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KPICard label="ROI"       value={kpis.roi.toFixed(2)}           color="#818cf8" icon={<Percent         size={15} />} />
        <KPICard label="% Bonus"   value={pct.format(kpis.bonus_pct)}    color="#f97316" icon={<Gift            size={15} />} />
        <KPICard label="% Cashout" value={pct.format(kpis.cashout_pct)}  color="#ef4444" icon={<ArrowDownCircle size={15} />} />
        <KPICard label="ADPU"      value={formatEur(kpis.adpu)}         color="#00d4ff" icon={<Users           size={15} />} />
        <KPICard label="ARPU"      value={formatEur(kpis.arpu)}         color="#10b981" icon={<BarChart2       size={15} />} />
        <KPICard label="ECPA"      value={formatEur(kpis.ecpa)}         color="#f97316" icon={<Target          size={15} />} />
      </div>

      {timeData.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <div className="chart-title">Performance Over Time</div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gAffRev"    x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gAffCost"   x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f0b429" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#f0b429" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gAffProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="date"  stroke={axisStroke} tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis                 stroke={axisStroke} tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="revenue" stroke="#00d4ff" strokeWidth={1.5} fillOpacity={1} fill="url(#gAffRev)"    />
              <Area type="monotone" dataKey="cost"    stroke="#f0b429" strokeWidth={1.5} fillOpacity={1} fill="url(#gAffCost)"   />
              <Area type="monotone" dataKey="profit"  stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#gAffProfit)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {byBrand.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
          <div className="chart-title" style={{ padding: '12px 14px 0' }}>By Brand</div>
          <PivotTable rowLabel="Brand" rows={byBrand} data={scoped} />
        </div>
      )}

      {byCountry.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
          <div className="chart-title" style={{ padding: '12px 14px 0' }}>By Country</div>
          <PivotTable rowLabel="Country" rows={byCountry} data={scoped} />
        </div>
      )}
    </div>
  );
};
