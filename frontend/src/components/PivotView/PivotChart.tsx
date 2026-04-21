import { useMemo } from 'react';
import { useChartColors } from '../../lib/theme';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { PivotRow } from '../../utils/pivotAggregate';

interface Props {
  rows: PivotRow[];
  kind: 'time' | 'categorical';
  metric?: 'revenue' | 'profit' | 'ftds' | 'roi';
}

const COLORS = [
  '#00d4ff', '#818cf8', '#10b981', '#f0b429', '#ef4444', '#ec4899',
  '#f97316', '#a78bfa', '#34d399', '#fbbf24', '#6366f1',
];

export function PivotChart({ rows, kind, metric = 'revenue' }: Props) {
  const { axisColor, axisStroke, tooltipStyle } = useChartColors();

  const chartData = useMemo(
    () => rows.map(r => ({
      key:      r.key,
      revenue:  r.kpis.revenue,
      profit:   r.kpis.profit,
      ftds:     r.kpis.ftds,
      roi:      r.kpis.roi,
    })),
    [rows],
  );

  const yTickFmt = (v: number) => {
    if (metric === 'ftds' || metric === 'roi') return v.toFixed(metric === 'roi' ? 2 : 0);
    if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `€${(v / 1_000).toFixed(0)}k`;
    return `€${v}`;
  };

  if (kind === 'time') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gPivotTime" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <XAxis dataKey="key" stroke={axisStroke} tick={{ fontSize: 11, fill: axisColor }} />
          <YAxis stroke={axisStroke} tick={{ fontSize: 11, fill: axisColor }} tickFormatter={yTickFmt} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => yTickFmt(Number(v))} />
          <Area type="monotone" dataKey={metric} stroke="#00d4ff" strokeWidth={1.5} fillOpacity={1} fill="url(#gPivotTime)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(chartData.length * 24, 200)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 2, right: 40, bottom: 2, left: 0 }} barSize={14}>
        <XAxis type="number" stroke={axisStroke} tick={{ fontSize: 10, fill: axisColor }} tickFormatter={yTickFmt} />
        <YAxis type="category" dataKey="key" stroke={axisStroke} tick={{ fontSize: 10, fill: axisColor }} width={80} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => yTickFmt(Number(v))} />
        <Bar dataKey={metric} radius={[0, 4, 4, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
