import React from 'react';
import { PivotView } from '../components/PivotView/PivotView';
import type { PerformanceRecord } from '../utils/kpiEngine';

export const ByCountry: React.FC<{ data: PerformanceRecord[] }> = ({ data }) => (
  <PivotView
    title="By Country"
    subtitle="Grouped by Player_country"
    rowLabel="Country"
    groupBy="player_country"
    data={data}
    chartKind="categorical"
    chartMetric="revenue"
    entity="countries"
  />
);
