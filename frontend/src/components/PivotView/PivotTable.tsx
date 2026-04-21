import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { PivotRow } from '../../utils/pivotAggregate';
import { processKPIs, type PerformanceRecord } from '../../utils/kpiEngine';

interface Props {
  rowLabel: string;                  // column header for the group-by column, e.g. 'Month'
  rows: PivotRow[];                  // aggregated data from pivotAggregate
  data: PerformanceRecord[];         // unfiltered-by-group data for the totals row
}

type SortKey =
  | 'key' | 'count' | 'revenue' | 'cost' | 'profit' | 'roi'
  | 'ftds' | 'adpu' | 'arpu' | 'ecpa';

const formatEur = (v: number) =>
  `€${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v)}`;

const formatNum = (v: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);

const formatRoi = (v: number) => v.toFixed(2);

export function PivotTable({ rowLabel, rows, data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const totals = useMemo(() => processKPIs(data), [data]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = sortKey === 'key' ? a.key : sortKey === 'count' ? a.count : (a.kpis as any)[sortKey];
      const bv = sortKey === 'key' ? b.key : sortKey === 'count' ? b.count : (b.kpis as any)[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const astr = String(av ?? ''); const bstr = String(bv ?? '');
      return sortDir === 'asc' ? astr.localeCompare(bstr) : bstr.localeCompare(astr);
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir(k === 'key' ? 'asc' : 'desc'); }
  };

  const th = (k: SortKey, label: string, align: 'left' | 'right' = 'right') => (
    <th
      onClick={() => toggle(k)}
      className={`pivot-table__th pivot-table__th--${align}${sortKey === k ? ' is-sorted' : ''}`}
    >
      <span>{label}</span>
      {sortKey === k && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
    </th>
  );

  return (
    <div className="pivot-table-wrap">
      <table className="pivot-table">
        <thead>
          <tr>
            {th('key',     rowLabel, 'left')}
            {th('count',   'Rows')}
            {th('ftds',    'FTD')}
            {th('revenue', 'Deposits')}
            {th('cost',    'Partner Inc.')}
            {th('profit',  'Profit')}
            {th('roi',     'ROI')}
            {th('adpu',    'ADPU')}
            {th('arpu',    'ARPU')}
            {th('ecpa',    'ECPA')}
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.key}>
              <td className="pivot-table__td--left">{r.key}</td>
              <td>{formatNum(r.count)}</td>
              <td>{formatNum(r.kpis.ftds)}</td>
              <td>{formatEur(r.kpis.revenue)}</td>
              <td>{formatEur(r.kpis.cost)}</td>
              <td>{formatEur(r.kpis.profit)}</td>
              <td>{formatRoi(r.kpis.roi)}</td>
              <td>{formatEur(r.kpis.adpu)}</td>
              <td>{formatEur(r.kpis.arpu)}</td>
              <td>{formatEur(r.kpis.ecpa)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pivot-table__td--left">Total</td>
            <td>{formatNum(data.length)}</td>
            <td>{formatNum(totals.ftds)}</td>
            <td>{formatEur(totals.revenue)}</td>
            <td>{formatEur(totals.cost)}</td>
            <td>{formatEur(totals.profit)}</td>
            <td>{formatRoi(totals.roi)}</td>
            <td>{formatEur(totals.adpu)}</td>
            <td>{formatEur(totals.arpu)}</td>
            <td>{formatEur(totals.ecpa)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
