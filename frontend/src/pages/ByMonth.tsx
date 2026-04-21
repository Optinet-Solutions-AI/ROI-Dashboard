import React from 'react';
import { PivotView } from '../components/PivotView/PivotView';
import type { PerformanceRecord } from '../utils/kpiEngine';

export const ByMonth: React.FC<{ data: PerformanceRecord[] }> = ({ data }) => (
  <PivotView
    title="By Month"
    subtitle="Grouped by FTD month (FD_Date)"
    rowLabel="Month"
    groupBy="ftd_month"
    data={data}
    chartKind="time"
    chartMetric="revenue"
    entity="months"
  />
);
