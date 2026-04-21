import { useChartColors } from '../lib/theme';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { CohortAggregate, CohortMetric } from '../utils/cohortAggregate';
import './CohortChart.css';

interface Props {
  aggregate: CohortAggregate;
  metric:    CohortMetric;
}

const COLORS = [
  '#00d4ff', '#818cf8', '#10b981', '#f0b429', '#ef4444', '#ec4899',
  '#f97316', '#a78bfa', '#34d399', '#fbbf24', '#6366f1', '#22d3ee',
  '#f472b6', '#84cc16', '#facc15', '#06b6d4',
];

const metricLabel = (m: CohortMetric) => {
  switch (m) {
    case 'revenue': return 'Deposits Sum';
    case 'ftds':    return 'FTD';
    case 'profit':  return 'Profit';
    case 'ngr':     return 'NGR';
    case 'cost':    return 'Partner Income';
  }
};

const formatValue = (v: number, metric: CohortMetric) => {
  if (metric === 'ftds') return new Intl.NumberFormat('en-US').format(v);
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `€${(v / 1_000).toFixed(0)}k`;
  return `€${Math.round(v)}`;
};

export function CohortChart({ aggregate, metric }: Props) {
  const { axisColor, axisStroke, tooltipStyle } = useChartColors();
  const { cohorts, chartData } = aggregate;

  return (
    <div className="cohort-chart">
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <XAxis
            dataKey="period"
            type="number"
            domain={[0, 'dataMax']}
            stroke={axisStroke}
            tick={{ fontSize: 11, fill: axisColor }}
            label={{ value: 'Period (months since FTD)', position: 'insideBottom', offset: -2, fill: axisColor, fontSize: 11 }}
          />
          <YAxis
            stroke={axisStroke}
            tick={{ fontSize: 11, fill: axisColor }}
            tickFormatter={v => formatValue(Number(v), metric)}
            label={{ value: metricLabel(metric), angle: -90, position: 'insideLeft', fill: axisColor, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => formatValue(Number(v), metric)}
          />
          <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: 8 }} />
          {cohorts.map((cohort, i) => (
            <Line
              key={cohort}
              type="monotone"
              dataKey={cohort}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={1.5}
              dot={{ r: 2 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
