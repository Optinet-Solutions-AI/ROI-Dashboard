import { useMemo } from 'react';
import { pivotAggregate, type PivotKey } from '../../utils/pivotAggregate';
import { PivotTable } from './PivotTable';
import { PivotChart } from './PivotChart';
import { NoMatchingRows } from '../NoMatchingRows';
import type { PerformanceRecord } from '../../utils/kpiEngine';
import './PivotView.css';

interface Props {
  title: string;
  subtitle?: string;
  rowLabel: string;
  groupBy: PivotKey;
  data: PerformanceRecord[];
  chartKind: 'time' | 'categorical';
  chartMetric?: 'revenue' | 'profit' | 'ftds' | 'roi';
  entity?: string;   // 'months', 'countries', 'brands', 'sources' — for the empty-state label
}

export function PivotView({
  title, subtitle, rowLabel, groupBy, data, chartKind, chartMetric = 'revenue', entity = 'rows',
}: Props) {
  const rows = useMemo(() => pivotAggregate(data, groupBy), [data, groupBy]);

  return (
    <div>
      <div className="header">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>

      {rows.length === 0
        ? <NoMatchingRows entity={entity} />
        : (
            <div className="pivot-view">
              <div className="pivot-view__chart chart-card">
                <div className="chart-title">{title} — {chartMetric === 'revenue' ? 'Deposits Sum' : chartMetric === 'profit' ? 'Profit' : chartMetric === 'ftds' ? 'FTD' : 'ROI'}</div>
                <PivotChart rows={rows} kind={chartKind} metric={chartMetric} />
              </div>
              <div className="pivot-view__table chart-card">
                <PivotTable rowLabel={rowLabel} rows={rows} data={data} />
              </div>
            </div>
          )
      }
    </div>
  );
}
