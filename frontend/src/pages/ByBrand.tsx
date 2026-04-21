import React from 'react';
import { PivotView } from '../components/PivotView/PivotView';
import type { PerformanceRecord } from '../utils/kpiEngine';

export const ByBrand: React.FC<{ data: PerformanceRecord[] }> = ({ data }) => (
  <PivotView
    title="By Brand"
    subtitle="Grouped by Brand"
    rowLabel="Brand"
    groupBy="brand"
    data={data}
    chartKind="categorical"
    chartMetric="revenue"
    entity="brands"
  />
);
