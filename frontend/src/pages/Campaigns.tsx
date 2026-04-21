import React from 'react';
import type { PerformanceRecord } from '../utils/kpiEngine';
import { NoMatchingRows } from '../components/NoMatchingRows';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const Campaigns: React.FC<{ data: PerformanceRecord[] }> = ({ data }) => {
  if (data.length === 0) return <NoMatchingRows entity="campaigns" />;

  const campMap: Record<string, any> = {};
  data.forEach(d => {
    const camp = d.campaign || d.brand;
    if (!camp) return;
    if (!campMap[camp]) campMap[camp] = { campaign: camp, profit: 0, cost: 0, revenue: 0 };
    campMap[camp].profit += (Number(d.revenue) || 0) - (Number(d.cost) || 0);
    campMap[camp].cost += Number(d.cost) || 0;
    campMap[camp].revenue += Number(d.revenue) || 0;
  });

  const campData = Object.values(campMap).map(c => ({
    ...c,
    roi: c.cost > 0 ? c.profit / c.cost : 0,
  })).sort((a, b) => b.roi - a.roi).slice(0, 10);

  const formatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 });

  return (
    <div>
      <div className="header">
        <h1>Campaigns</h1>
        <p>Top Campaigns by ROI</p>
      </div>

      <div className="chart-card" style={{ height: '500px' }}>
        <div className="chart-title">ROI by Campaign</div>
        {campData.length > 0 ? (
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={campData} margin={{ top: 20 }}>
              <XAxis dataKey="campaign" stroke="#2d3e52" tick={{ fontSize: 11, fill: '#536b87' }} />
              <YAxis stroke="#2d3e52" tick={{ fontSize: 11, fill: '#536b87' }} tickFormatter={(val) => formatter.format(val)} />
              <Tooltip formatter={(value) => formatter.format(Number(value))} contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#111827', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }} />
              <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
                {campData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.roi >= 0 ? '#7c3aed' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p>No campaign data available.</p>
        )}
      </div>
    </div>
  );
};
