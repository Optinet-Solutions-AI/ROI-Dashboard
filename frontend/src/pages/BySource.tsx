import React from 'react';
import { PivotView } from '../components/PivotView/PivotView';
import type { PerformanceRecord } from '../utils/kpiEngine';

export const BySource: React.FC<{ data: PerformanceRecord[] }> = ({ data }) => (
  <PivotView
    title="By Source"
    subtitle="Grouped by Source"
    rowLabel="Source"
    groupBy="source"
    data={data}
    chartKind="categorical"
    chartMetric="revenue"
    entity="sources"
  />
);
