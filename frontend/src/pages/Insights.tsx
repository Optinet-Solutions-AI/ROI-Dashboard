import React from 'react';
import { Trophy, AlertTriangle, Lightbulb } from 'lucide-react';
import { type PerformanceRecord, getInsights } from '../utils/kpiEngine';
import { NoMatchingRows } from '../components/NoMatchingRows';

export const Insights: React.FC<{ data: PerformanceRecord[] }> = ({ data }) => {
  if (data.length === 0) return <NoMatchingRows entity="insights" />;

  const { top_affiliates, worst_affiliates, recommendations } = getInsights(data);

  return (
    <div>
      <div className="header">
        <h1>Insights</h1>
        <p>Automated analysis and recommendations</p>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card" style={{ height: 'auto', minHeight: 'unset' }}>
          <div className="chart-title" style={{ color: 'var(--cyan)' }}>
            <Trophy size={14} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
            Top Performers
          </div>
          {top_affiliates.length > 0 ? top_affiliates.map((aff, idx) => (
            <div key={idx} className="insight-banner" style={{ borderLeftColor: 'var(--cyan)' }}>
              <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
                #{String(idx + 1).padStart(2, '0')}
              </span>
              {' '}
              <strong>{aff.name || aff.id}</strong>
              {aff.name && (
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginLeft: 8 }}>
                  ({aff.id})
                </span>
              )}
            </div>
          )) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Not enough data.</p>
          )}
        </div>

        <div className="chart-card" style={{ height: 'auto', minHeight: 'unset' }}>
          <div className="chart-title" style={{ color: 'var(--red)' }}>
            <AlertTriangle size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
            Underperformers — Negative ROI
          </div>
          {worst_affiliates.length > 0 ? worst_affiliates.map((aff, idx) => (
            <div key={idx} className="insight-banner" style={{ borderLeftColor: 'var(--red)', background: 'linear-gradient(90deg, rgba(239,68,68,0.06) 0%, rgba(6,11,19,0.3) 100%)' }}>
              <span className="badge badge--red">Action Needed</span>
              {' '}
              <strong style={{ marginLeft: 6 }}>{aff.name || aff.id}</strong>
              {aff.name && (
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginLeft: 8 }}>
                  ({aff.id})
                </span>
              )}
            </div>
          )) : (
            <p style={{ color: 'var(--green)', fontSize: '0.875rem' }}>
              No underperforming affiliates detected.
            </p>
          )}
        </div>
      </div>

      <div className="chart-card" style={{ marginTop: 16, height: 'auto', minHeight: 'unset' }}>
        <div className="chart-title" style={{ color: 'var(--gold)' }}>
          <Lightbulb size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          Recommendations
        </div>
        {recommendations.map((rec, idx) => (
          <div
            key={idx}
            className="insight-banner"
            style={{
              borderLeftColor: 'var(--gold)',
              background: 'linear-gradient(90deg, rgba(240,180,41,0.07) 0%, rgba(6,11,19,0.3) 100%)',
            }}
          >
            <span style={{ color: 'var(--gold)', fontWeight: 700, marginRight: 6 }}>▸</span>
            {rec}
          </div>
        ))}
      </div>
    </div>
  );
};
