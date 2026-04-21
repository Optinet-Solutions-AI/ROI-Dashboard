import React, { useMemo, useState } from 'react';
import { NoMatchingRows } from '../components/NoMatchingRows';
import { CohortChart } from '../components/CohortChart';
import { cohortAggregate, type CohortMetric } from '../utils/cohortAggregate';
import type { PerformanceRecord } from '../utils/kpiEngine';

const METRICS: { key: CohortMetric; label: string }[] = [
  { key: 'revenue', label: 'Deposits Sum' },
  { key: 'ngr',     label: 'NGR' },
  { key: 'profit',  label: 'Profit' },
  { key: 'ftds',    label: 'FTD' },
  { key: 'cost',    label: 'Partner Income' },
];

export const Cohort: React.FC<{ data: PerformanceRecord[] }> = ({ data }) => {
  const [metric, setMetric] = useState<CohortMetric>('revenue');
  const aggregate = useMemo(() => cohortAggregate(data, { metric }), [data, metric]);

  if (data.length === 0) return <NoMatchingRows entity="cohort rows" />;

  return (
    <div>
      <div className="header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Cohort</h1>
          <p>Rows grouped by FTD month, plotted across Period (months since FTD)</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Metric</label>
          <select
            value={metric}
            onChange={e => setMetric(e.target.value as CohortMetric)}
            style={{
              padding: '5px 8px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
            }}
          >
            {METRICS.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {aggregate.cohorts.length === 0
        ? <NoMatchingRows entity="cohorts" />
        : (
            <div className="chart-card" style={{ padding: 4 }}>
              <CohortChart aggregate={aggregate} metric={metric} />
            </div>
          )
      }
    </div>
  );
};
