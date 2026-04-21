# Excel Pivot Views — Implementation Plan (Plan 2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four dimension-grouped pivot pages the ROI workbook exposes — Main (by Month), Country (by Player_country), Brand (by Brand), and Affiliates (by Source) — using a shared reusable `PivotView` that renders a sortable aggregate table beside a dimension-appropriate chart. All four pages consume the Plan 1 global filter bar automatically.

**Architecture:**
- One pure aggregator, `pivotAggregate(data, groupBy)`, groups records by a dimension key and runs the existing `processKPIs` over each group. This means every KPI already rendered on Overview (ROI, %Bonus, %Cashout, ADPU, ARPU, ECPA) is automatically available per pivot row — no re-implementation.
- One shared `PivotView` React component composes `PivotTable` (sortable, totals row) + `PivotChart` (bar for categorical dims, area for time dims). Each page is a ~15-line wrapper that specifies the groupBy key, the chart type, and the label.
- The pivot pages read `filteredData` from `App.tsx`'s existing pipeline. No new filter state, no new context.
- A shared `NoMatchingRows` component handles the "filters narrowed to zero" case on pivot pages (and is ready to retrofit into existing pages in a later polish pass).

**Tech Stack:** React 19, TypeScript 6, Vite 8, vitest 4, recharts, lucide-react. No new dependencies.

**Scope boundary — what this plan does NOT do:**
- No Period cohort ladder chart (Plan 4).
- No `/affiliates/:partnerId` profile page (Plan 3).
- No retrofit of `NoMatchingRows` onto the existing Overview/Affiliates/Campaigns/Insights/Data pages — only new pivot pages use it. (Retrofit is a ~10-minute follow-up after Plan 2 lands.)
- No new filter dimensions — everything pivots against data already in `filteredData`.
- No Excel-style "QA" pivot — that sheet in the workbook is a QA lens over the same data; our existing Overview + the 4 new pivots cover that surface.

**Plan 1 follow-ups addressed in this plan:**
- **Follow-up 1** — Fixture-based parser round-trip test. Task 1 replaces the `it.todo` in `excelParser.test.ts` with a real test that round-trips a Date cell through `XLSX.utils.book_new()` + `parseExcelFile`.
- **Follow-up 3** — Empty-filtered-state UX. Task 2 adds a shared `NoMatchingRows` component, used by the new pivot pages.
- Follow-up 2 (bundle-size audit) is deferred to Plan 4 as noted.

---

## File Structure

**New files:**
- `frontend/src/utils/__tests__/excelParser.fixture.test.ts` — fixture-based `parseExcelFile` round-trip test
- `frontend/src/components/NoMatchingRows.tsx` — shared empty-state banner for filter-zero results
- `frontend/src/utils/pivotAggregate.ts` — pure aggregator: `(data, groupBy) → PivotRow[]`
- `frontend/src/utils/__tests__/pivotAggregate.test.ts`
- `frontend/src/components/PivotView/PivotTable.tsx` — sortable table with totals row
- `frontend/src/components/PivotView/PivotChart.tsx` — bar or area chart
- `frontend/src/components/PivotView/PivotView.tsx` — composes label + table + chart
- `frontend/src/components/PivotView/PivotView.css` — scoped styles
- `frontend/src/pages/ByMonth.tsx` — pivot grouped by `ftd_month`
- `frontend/src/pages/ByCountry.tsx` — pivot grouped by `player_country`
- `frontend/src/pages/ByBrand.tsx` — pivot grouped by `brand`
- `frontend/src/pages/BySource.tsx` — pivot grouped by `source`

**Modified files:**
- `frontend/src/utils/__tests__/excelParser.test.ts` — remove the `it.todo` placeholder (its coverage moves to the new fixture test)
- `frontend/src/App.tsx` — add 4 new tab IDs; route to the new pages inside the page-rendering branch
- `frontend/src/components/Sidebar.tsx` — add 4 new nav entries under a "Pivots" group heading

---

## Task 1: Fixture-based parser round-trip test (Plan 1 follow-up #1)

Replaces the `it.todo` placeholder with a real test that exercises the full `XLSX.read → sheet_to_json → parseExcelFile → newRow` chain with a native Excel Date cell. This is the regression guard that would have caught the three-iteration `dateNF` bug during Plan 1.

**Files:**
- Create: `frontend/src/utils/__tests__/excelParser.fixture.test.ts`
- Modify: `frontend/src/utils/__tests__/excelParser.test.ts:14-22` (remove the `it.todo` block)

- [ ] **Step 1: Write the fixture test**

Create `frontend/src/utils/__tests__/excelParser.fixture.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcelFile } from '../excelParser';

/**
 * Build an in-memory .xlsx with a native Excel Date cell plus the other
 * filter-parity columns, write it to a Uint8Array, wrap that in a File,
 * and round-trip it through parseExcelFile. This is the regression guard
 * for the XLSX.read dateNF/cellDates contract.
 */
function buildWorkbook(): Uint8Array {
  const aoa = [
    ['Partner_ID', 'Company_name', 'Player_country', 'FD_Date', 'Brand', 'AM', 'Source', 'Period', 'problematic_source', 'FTD', 'Deposits_sum', 'Partner_income'],
    [173343,       'Acme Ltd',      'DE',             new Date(Date.UTC(2026, 2, 15)), 'SP', 'Gemma', 'FP', 0, 0, 5, 1000, 400],
    [161653,       'Beta Inc',      'AT',             new Date(Date.UTC(2026, 1, 1)),  'L7', 'Charisse', 'L7', 1, 1, 3, 600, 250],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const book  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Data');
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' });
}

function toFile(bytes: Uint8Array, name = 'fixture.xlsx'): File {
  return new File([bytes], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('parseExcelFile — fixture round-trip', () => {
  it('emits ISO date strings for native Excel Date cells', async () => {
    const rows = await parseExcelFile(toFile(buildWorkbook()));

    expect(rows).toHaveLength(2);

    const row0 = rows[0];
    expect(row0.date).toBe('2026-03-15');
    expect(row0.ftd_month).toBe('2026-03');
  });

  it('keeps company_name and player_country distinct from affiliate_name and country', async () => {
    const rows = await parseExcelFile(toFile(buildWorkbook()));
    const row0 = rows[0];

    expect(row0.company_name).toBe('Acme Ltd');
    expect(row0.player_country).toBe('DE');
    // affiliate_name is not populated by this fixture (no Partner_name column),
    // so it must remain undefined — proving the aliases do NOT collapse fields.
    expect(row0.affiliate_name).toBeUndefined();
    // Likewise country (general) should NOT be populated from player_country.
    expect(row0.country).toBeUndefined();
  });

  it('coerces problematic_source to a number (0 or 1)', async () => {
    const rows = await parseExcelFile(toFile(buildWorkbook()));
    expect(rows[0].problematic_source).toBe(0);
    expect(rows[1].problematic_source).toBe(1);
    expect(typeof rows[0].problematic_source).toBe('number');
  });

  it('preserves Partner_ID as affiliate_id', async () => {
    const rows = await parseExcelFile(toFile(buildWorkbook()));
    expect(String(rows[0].affiliate_id)).toBe('173343');
    expect(String(rows[1].affiliate_id)).toBe('161653');
  });
});
```

- [ ] **Step 2: Remove the `it.todo` placeholder**

Open `frontend/src/utils/__tests__/excelParser.test.ts`. Find the block:

```ts
describe('parseExcelFile row shape', () => {
  // File-based tests live here once we have a tiny fixture; the
  // critical behaviour to cover end-to-end is that Company_name
  // does NOT collapse into affiliate_name, and Player_country
  // does NOT collapse into country.
  // For Task 3 we rely on Step 2's alias map + a direct unit
  // test against deriveFtdMonth below.
  it.todo('add fixture-based roundtrip once a tiny .xlsx is checked in');
});
```

Delete the entire `describe('parseExcelFile row shape', ...)` block. The coverage is now in the new fixture test file. The rest of the file (`normalizeColumnName`, `deriveFtdMonth` describes) stays intact.

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd frontend && npm test -- excelParser`
Expected: both test files run. `excelParser.test.ts` now has 1 (normalizeColumnName) + 5 (deriveFtdMonth) = 6 tests + 0 todos. `excelParser.fixture.test.ts` has 4 tests. All pass.

Also run full suite: `cd frontend && npm test`
Expected: frontend total shifts from 24 + 1 todo to 28 + 0 todos.

- [ ] **Step 4: Commit on `dev`**

```bash
git add frontend/src/utils/__tests__/excelParser.fixture.test.ts frontend/src/utils/__tests__/excelParser.test.ts
git commit -m "test(parser): add fixture round-trip test, remove it.todo placeholder"
```

---

## Task 2: Shared `NoMatchingRows` empty-state component (Plan 1 follow-up #3)

**Files:**
- Create: `frontend/src/components/NoMatchingRows.tsx`

- [ ] **Step 1: Implement the component**

Create `frontend/src/components/NoMatchingRows.tsx`:

```tsx
import { FilterX } from 'lucide-react';
import { useFilters } from '../contexts/FilterContext';

/**
 * Rendered by pivot/list pages when filters reduce results to zero.
 * Reads the FilterContext directly so callers don't need to pass a reset
 * handler. Safe to render inside any tree wrapped by <FilterProvider>.
 */
export function NoMatchingRows({ entity = 'rows' }: { entity?: string }) {
  const { reset, activeCount } = useFilters();

  return (
    <div className="no-matching-rows" role="status">
      <div className="no-matching-rows__icon">
        <FilterX size={28} />
      </div>
      <h3>No {entity} match the current filters</h3>
      <p>
        {activeCount === 1
          ? '1 filter is active.'
          : `${activeCount} filters are active.`}{' '}
        Try widening or clearing them.
      </p>
      <button type="button" className="no-matching-rows__reset" onClick={reset}>
        Clear all filters
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add styles**

The component uses three classes. Append these rules to `frontend/src/index.css` (the project's shared stylesheet) — add them at the bottom of the file so they're easy to find later:

```css
/* NoMatchingRows — shared empty state for filter-zero pages */
.no-matching-rows {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 36px 24px;
  text-align: center;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1px dashed var(--border);
  border-radius: 12px;
  margin: 12px 0;
}
.no-matching-rows__icon {
  color: var(--text-secondary);
  opacity: 0.7;
}
.no-matching-rows h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 600;
}
.no-matching-rows p { margin: 0; font-size: 0.8rem; }
.no-matching-rows__reset {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.8rem;
  cursor: pointer;
  margin-top: 4px;
}
.no-matching-rows__reset:hover { background: rgba(0, 212, 255, 0.08); }
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run build`
Expected: clean.

- [ ] **Step 4: Commit on `dev`**

```bash
git add frontend/src/components/NoMatchingRows.tsx frontend/src/index.css
git commit -m "feat(ui): add NoMatchingRows empty-state component"
```

---

## Task 3: `pivotAggregate` pure function (TDD)

**Files:**
- Create: `frontend/src/utils/pivotAggregate.ts`
- Create: `frontend/src/utils/__tests__/pivotAggregate.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/utils/__tests__/pivotAggregate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pivotAggregate } from '../pivotAggregate';
import type { PerformanceRecord } from '../kpiEngine';

const data: PerformanceRecord[] = [
  { affiliate_id: '1', brand: 'SP', player_country: 'DE', ftd_month: '2026-03', revenue: 100, cost: 40, ftds: 2, casino_real_ngr: 50, sb_real_ngr: 0, flats_and_adjustments: 0 },
  { affiliate_id: '2', brand: 'SP', player_country: 'AT', ftd_month: '2026-02', revenue: 200, cost: 80, ftds: 3, casino_real_ngr: 120, sb_real_ngr: 0, flats_and_adjustments: 0 },
  { affiliate_id: '3', brand: 'L7', player_country: 'DE', ftd_month: '2026-03', revenue: 300, cost: 100, ftds: 4, casino_real_ngr: 180, sb_real_ngr: 0, flats_and_adjustments: 0 },
];

describe('pivotAggregate', () => {
  it('groups by a categorical dimension and sums metrics per group', () => {
    const rows = pivotAggregate(data, 'brand');
    const byKey = Object.fromEntries(rows.map(r => [r.key, r]));

    expect(rows).toHaveLength(2);
    expect(byKey.SP.count).toBe(2);
    expect(byKey.SP.kpis.revenue).toBe(300);
    expect(byKey.SP.kpis.cost).toBe(120);
    expect(byKey.SP.kpis.ftds).toBe(5);
    expect(byKey.L7.count).toBe(1);
    expect(byKey.L7.kpis.revenue).toBe(300);
  });

  it('computes per-group KPIs via processKPIs (ROI, ARPU, ADPU, ECPA)', () => {
    const rows = pivotAggregate(data, 'brand');
    const sp = rows.find(r => r.key === 'SP')!;
    // SP: revenue=300, cost=120, ftds=5, ngr=170, spend=120, flats=0
    // ROI = 170 / 120 = 1.4166…, ADPU = 300/5 = 60, ARPU = 170/5 = 34, ECPA = 120/5 = 24
    expect(sp.kpis.roi).toBeCloseTo(170 / 120, 4);
    expect(sp.kpis.adpu).toBe(60);
    expect(sp.kpis.arpu).toBe(34);
    expect(sp.kpis.ecpa).toBe(24);
  });

  it('omits rows whose group key is null/undefined/empty', () => {
    const dataWithBlank: PerformanceRecord[] = [
      ...data,
      { affiliate_id: '4', brand: undefined, revenue: 999 },
      { affiliate_id: '5', brand: '', revenue: 999 },
    ];
    const rows = pivotAggregate(dataWithBlank, 'brand');
    expect(rows.map(r => r.key).sort()).toEqual(['L7', 'SP']);
  });

  it('sorts results numerically when all keys parse as numbers, else alphabetically', () => {
    const numericRows = pivotAggregate(
      [
        { affiliate_id: '1', period: 10 } as PerformanceRecord,
        { affiliate_id: '2', period: 2 } as PerformanceRecord,
        { affiliate_id: '3', period: 1 } as PerformanceRecord,
      ],
      'period',
    );
    expect(numericRows.map(r => r.key)).toEqual(['1', '2', '10']);

    const alphaRows = pivotAggregate(data, 'player_country');
    expect(alphaRows.map(r => r.key)).toEqual(['AT', 'DE']);
  });

  it('returns an empty array on empty input', () => {
    expect(pivotAggregate([], 'brand')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and confirm failure**

Run: `cd frontend && npm test -- pivotAggregate`
Expected: all tests fail with "Failed to resolve import '../pivotAggregate'".

- [ ] **Step 3: Implement `pivotAggregate`**

Create `frontend/src/utils/pivotAggregate.ts`:

```ts
import type { PerformanceRecord } from './kpiEngine';
import { processKPIs } from './kpiEngine';

export type PivotKey = keyof PerformanceRecord;

export interface PivotRow {
  key: string;                                    // e.g. 'SP', 'DE', '2026-03', '1'
  count: number;                                  // rows contributing to this group
  kpis: ReturnType<typeof processKPIs>;           // full KPI set for the group
}

/**
 * Group records by the given dimension and compute the full KPI set
 * (revenue, cost, profit, ROI, FTD, ADPU, ARPU, ECPA, %Bonus, %Cashout, etc.)
 * for each group via the existing processKPIs. This is what lets every
 * pivot page render the same KPI columns the Overview uses.
 */
export function pivotAggregate(
  data: PerformanceRecord[],
  groupBy: PivotKey,
): PivotRow[] {
  const groups = new Map<string, PerformanceRecord[]>();

  for (const r of data) {
    const raw = r[groupBy];
    const key = raw == null ? '' : String(raw).trim();
    if (!key) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(r);
    else groups.set(key, [r]);
  }

  const rows: PivotRow[] = [];
  for (const [key, rowsInGroup] of groups) {
    rows.push({ key, count: rowsInGroup.length, kpis: processKPIs(rowsInGroup) });
  }

  // Sort numerically when every key parses as a finite number, else alphabetically.
  const allNumeric = rows.every(r => Number.isFinite(Number(r.key)));
  rows.sort((a, b) => allNumeric
    ? Number(a.key) - Number(b.key)
    : a.key.localeCompare(b.key));

  return rows;
}
```

- [ ] **Step 4: Run tests and confirm pass**

Run: `cd frontend && npm test -- pivotAggregate`
Expected: all 5 tests pass.

Run full suite: `cd frontend && npm test`
Expected: no regressions; total bumps by 5 to ~33 tests.

- [ ] **Step 5: Commit on `dev`**

```bash
git add frontend/src/utils/pivotAggregate.ts frontend/src/utils/__tests__/pivotAggregate.test.ts
git commit -m "feat(pivot): add pivotAggregate pure function with TDD"
```

---

## Task 4: `PivotTable` component

Sortable aggregate table with a totals row. Columns match the KPIs on Overview for visual consistency.

**Files:**
- Create: `frontend/src/components/PivotView/PivotTable.tsx`

- [ ] **Step 1: Implement the component**

Create `frontend/src/components/PivotView/PivotTable.tsx`:

```tsx
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
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npm run build`
Expected: clean.

- [ ] **Step 3: Commit on `dev`**

```bash
git add frontend/src/components/PivotView/PivotTable.tsx
git commit -m "feat(pivot): add sortable PivotTable with totals row"
```

---

## Task 5: `PivotChart` component

Bar chart for categorical dims, area chart for time dims (`ftd_month`). Detects time vs categorical automatically.

**Files:**
- Create: `frontend/src/components/PivotView/PivotChart.tsx`

- [ ] **Step 1: Implement the component**

Create `frontend/src/components/PivotView/PivotChart.tsx`:

```tsx
import { useMemo } from 'react';
import { useChartColors } from '../../lib/theme';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { PivotRow } from '../../utils/pivotAggregate';

interface Props {
  rows: PivotRow[];
  kind: 'time' | 'categorical';
  metric?: 'revenue' | 'profit' | 'ftds' | 'roi';
}

const COLORS = [
  '#00d4ff', '#818cf8', '#10b981', '#f0b429', '#ef4444', '#ec4899',
  '#f97316', '#a78bfa', '#34d399', '#fbbf24', '#6366f1',
];

export function PivotChart({ rows, kind, metric = 'revenue' }: Props) {
  const { axisColor, axisStroke, tooltipStyle } = useChartColors();

  const chartData = useMemo(
    () => rows.map(r => ({
      key:      r.key,
      revenue:  r.kpis.revenue,
      profit:   r.kpis.profit,
      ftds:     r.kpis.ftds,
      roi:      r.kpis.roi,
    })),
    [rows],
  );

  const yTickFmt = (v: number) => {
    if (metric === 'ftds' || metric === 'roi') return v.toFixed(metric === 'roi' ? 2 : 0);
    if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `€${(v / 1_000).toFixed(0)}k`;
    return `€${v}`;
  };

  if (kind === 'time') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gPivotTime" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <XAxis dataKey="key" stroke={axisStroke} tick={{ fontSize: 11, fill: axisColor }} />
          <YAxis stroke={axisStroke} tick={{ fontSize: 11, fill: axisColor }} tickFormatter={yTickFmt} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => yTickFmt(Number(v))} />
          <Area type="monotone" dataKey={metric} stroke="#00d4ff" strokeWidth={1.5} fillOpacity={1} fill="url(#gPivotTime)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(chartData.length * 24, 200)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 2, right: 40, bottom: 2, left: 0 }} barSize={14}>
        <XAxis type="number" stroke={axisStroke} tick={{ fontSize: 10, fill: axisColor }} tickFormatter={yTickFmt} />
        <YAxis type="category" dataKey="key" stroke={axisStroke} tick={{ fontSize: 10, fill: axisColor }} width={80} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => yTickFmt(Number(v))} />
        <Bar dataKey={metric} radius={[0, 4, 4, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npm run build`
Expected: clean.

- [ ] **Step 3: Commit on `dev`**

```bash
git add frontend/src/components/PivotView/PivotChart.tsx
git commit -m "feat(pivot): add PivotChart with time vs categorical layouts"
```

---

## Task 6: `PivotView` composition + CSS

**Files:**
- Create: `frontend/src/components/PivotView/PivotView.tsx`
- Create: `frontend/src/components/PivotView/PivotView.css`

- [ ] **Step 1: Implement the composition**

Create `frontend/src/components/PivotView/PivotView.tsx`:

```tsx
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
```

- [ ] **Step 2: Add styles**

Create `frontend/src/components/PivotView/PivotView.css`:

```css
.pivot-view {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 1100px) {
  .pivot-view {
    grid-template-columns: 1fr;
  }
}

.pivot-view__chart { padding: 12px; }
.pivot-view__table { padding: 0; overflow: hidden; }

.pivot-table-wrap { overflow-x: auto; }

.pivot-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
  font-family: var(--font-body);
}

.pivot-table thead th,
.pivot-table tfoot td {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-secondary);
  font-weight: 600;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}
.pivot-table tfoot td {
  border-top: 1px solid var(--border);
  border-bottom: none;
  color: var(--text-primary);
}

.pivot-table tbody td {
  padding: 7px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
  text-align: right;
}
.pivot-table__td--left,
.pivot-table__th--left { text-align: left; }
.pivot-table__th--right { text-align: right; }

.pivot-table__th {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.pivot-table__th span { margin-right: 4px; }
.pivot-table__th.is-sorted { color: var(--text-primary); }

.pivot-table tbody tr:hover { background: rgba(0, 212, 255, 0.04); }
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run build`
Expected: clean.

- [ ] **Step 4: Commit on `dev`**

```bash
git add frontend/src/components/PivotView/PivotView.tsx frontend/src/components/PivotView/PivotView.css
git commit -m "feat(pivot): add PivotView composition with styles"
```

---

## Task 7: Four pivot pages

All four pages are thin wrappers over `PivotView`. Bundle them into one commit since they're ~10 lines each.

**Files:**
- Create: `frontend/src/pages/ByMonth.tsx`
- Create: `frontend/src/pages/ByCountry.tsx`
- Create: `frontend/src/pages/ByBrand.tsx`
- Create: `frontend/src/pages/BySource.tsx`

- [ ] **Step 1: Create all four pages**

`frontend/src/pages/ByMonth.tsx`:

```tsx
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
```

`frontend/src/pages/ByCountry.tsx`:

```tsx
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
```

`frontend/src/pages/ByBrand.tsx`:

```tsx
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
```

`frontend/src/pages/BySource.tsx`:

```tsx
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
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npm run build`
Expected: clean.

- [ ] **Step 3: Commit on `dev`**

```bash
git add frontend/src/pages/ByMonth.tsx frontend/src/pages/ByCountry.tsx frontend/src/pages/ByBrand.tsx frontend/src/pages/BySource.tsx
git commit -m "feat(pages): add ByMonth, ByCountry, ByBrand, BySource pivot pages"
```

---

## Task 8: Sidebar + App.tsx wiring

Add a "Pivots" group to the sidebar and route to the four new pages in `AppShell`.

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update the sidebar's TABS list**

Open `frontend/src/components/Sidebar.tsx`. Find the `TABS` constant (around line 19). Replace it with:

```ts
const TABS = [
  { id: 'Overview',   label: 'Overview',   Icon: LayoutDashboard },
  { id: 'AskAI',      label: 'Ask AI',     Icon: Sparkles        },
  { id: 'ByMonth',    label: 'By Month',   Icon: CalendarDays    },
  { id: 'ByCountry',  label: 'By Country', Icon: Globe           },
  { id: 'ByBrand',    label: 'By Brand',   Icon: Tag             },
  { id: 'BySource',   label: 'By Source',  Icon: Link            },
  { id: 'Affiliates', label: 'Affiliates', Icon: Users           },
  { id: 'Campaigns',  label: 'Campaigns',  Icon: Megaphone       },
  { id: 'Insights',   label: 'Insights',   Icon: Lightbulb       },
  { id: 'Data',       label: 'Raw Data',   Icon: Table           },
];
```

Also extend the `import` block at the top of the file so the new icons resolve. Find the existing `lucide-react` import:

```ts
import {
  UploadCloud, LayoutDashboard, Users, Megaphone,
  Lightbulb, Table, BarChart3, X, Sun, Moon, Trash2, Clock, Sparkles,
} from 'lucide-react';
```

Replace with:

```ts
import {
  UploadCloud, LayoutDashboard, Users, Megaphone,
  Lightbulb, Table, BarChart3, X, Sun, Moon, Trash2, Clock, Sparkles,
  CalendarDays, Globe, Tag, Link,
} from 'lucide-react';
```

- [ ] **Step 2: Route the new tab IDs in `App.tsx`**

Open `frontend/src/App.tsx`. Find the existing `TABS` constant (around line 78) and the existing `{activeTab === 'Overview' && ...}` block inside `AppShell` (around line 270).

First, extend the imports at the top. Find:

```ts
import { Overview } from './pages/Overview';
import { Affiliates } from './pages/Affiliates';
import { Campaigns } from './pages/Campaigns';
import { Insights } from './pages/Insights';
import { Data } from './pages/Data';
import { Deleted } from './pages/Deleted';
import { AskAI } from './pages/AskAI';
```

Add four more:

```ts
import { ByMonth } from './pages/ByMonth';
import { ByCountry } from './pages/ByCountry';
import { ByBrand } from './pages/ByBrand';
import { BySource } from './pages/BySource';
```

Then extend the top-level `TABS` constant in this file. Find:

```ts
const TABS = [
  { id: 'Overview',   label: 'Overview',   Icon: LayoutDashboard },
  { id: 'AskAI',      label: 'Ask AI',     Icon: Sparkles        },
  { id: 'Affiliates', label: 'Affiliates',  Icon: Users           },
  { id: 'Campaigns',  label: 'Campaigns',   Icon: Megaphone       },
  { id: 'Insights',   label: 'Insights',    Icon: Lightbulb       },
  { id: 'Data',       label: 'Data',        Icon: Table           },
  { id: 'Deleted',    label: 'Deleted',     Icon: Trash2          },
];
```

Extend the lucide import on line 2 (the one that starts `import { BarChart3, LayoutDashboard, ... }`) to include the same four new icons as Sidebar:

```ts
import {
  BarChart3, LayoutDashboard, Users, Megaphone, Lightbulb, Table, Menu, Trash2, Sparkles,
  CalendarDays, Globe, Tag, Link,
} from 'lucide-react';
```

Replace the `TABS` constant with:

```ts
const TABS = [
  { id: 'Overview',   label: 'Overview',   Icon: LayoutDashboard },
  { id: 'AskAI',      label: 'Ask AI',     Icon: Sparkles        },
  { id: 'ByMonth',    label: 'By Month',   Icon: CalendarDays    },
  { id: 'ByCountry',  label: 'By Country', Icon: Globe           },
  { id: 'ByBrand',    label: 'By Brand',   Icon: Tag             },
  { id: 'BySource',   label: 'By Source',  Icon: Link            },
  { id: 'Affiliates', label: 'Affiliates', Icon: Users           },
  { id: 'Campaigns',  label: 'Campaigns',  Icon: Megaphone       },
  { id: 'Insights',   label: 'Insights',   Icon: Lightbulb       },
  { id: 'Data',       label: 'Data',       Icon: Table           },
  { id: 'Deleted',    label: 'Deleted',    Icon: Trash2          },
];
```

Then in `AppShell`, find the block that renders the page for the active tab (around line 269-277):

```tsx
        {!loading && data.length > 0 && activeTab !== 'Deleted' && activeTab !== 'AskAI' && (
          <div className="fade-in">
            <FilterBar data={data} />
            {activeTab === 'Overview'   && <Overview   data={filteredData} />}
            {activeTab === 'Affiliates' && <Affiliates data={filteredData} />}
            {activeTab === 'Campaigns'  && <Campaigns  data={filteredData} />}
            {activeTab === 'Insights'   && <Insights   data={filteredData} />}
            {activeTab === 'Data'       && <Data       data={filteredData} />}
          </div>
        )}
```

Replace with:

```tsx
        {!loading && data.length > 0 && activeTab !== 'Deleted' && activeTab !== 'AskAI' && (
          <div className="fade-in">
            <FilterBar data={data} />
            {activeTab === 'Overview'   && <Overview   data={filteredData} />}
            {activeTab === 'ByMonth'    && <ByMonth    data={filteredData} />}
            {activeTab === 'ByCountry'  && <ByCountry  data={filteredData} />}
            {activeTab === 'ByBrand'    && <ByBrand    data={filteredData} />}
            {activeTab === 'BySource'   && <BySource   data={filteredData} />}
            {activeTab === 'Affiliates' && <Affiliates data={filteredData} />}
            {activeTab === 'Campaigns'  && <Campaigns  data={filteredData} />}
            {activeTab === 'Insights'   && <Insights   data={filteredData} />}
            {activeTab === 'Data'       && <Data       data={filteredData} />}
          </div>
        )}
```

- [ ] **Step 3: Type-check and test**

Run: `cd frontend && npm run build`
Expected: clean.

Run: `cd frontend && npm test`
Expected: same passing count as after Task 3 (~33 tests + fixture = ~37 depending on exact totals). No regressions.

- [ ] **Step 4: Manual smoke test — skip for implementer; user will verify**

The implementer does NOT run the dev server. The user will verify the four new tabs by running `npm run dev` and walking:

1. Click **By Month** → table sorted by Deposits desc, chart is an area chart over months.
2. Click **By Country** → horizontal bar chart, rows like `DE, AT, GR, …`.
3. Click **By Brand** → rows like `SP, L7, LV, RO, …`.
4. Click **By Source** → rows are the big Source strings from the workbook.
5. Apply a Brand filter → pivot narrows.
6. Apply a filter combination that yields zero rows → `NoMatchingRows` banner appears with a working "Clear all filters" button.
7. The Total row at the bottom of each table matches the Overview KPIs when no filters are active.

- [ ] **Step 5: Commit on `dev`**

```bash
git add frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat(pivot): wire ByMonth/ByCountry/ByBrand/BySource into sidebar and App"
```

---

## Self-Review Notes

**1. Spec coverage:**
- Excel Main sheet (row = FD_Date) → `ByMonth` (Task 7) ✓
- Excel Country sheet (row = Player_country) → `ByCountry` (Task 7) ✓
- Excel Brand sheet (row = Brand) → `ByBrand` (Task 7) ✓
- Excel Affiliates sheet (row = Source) → `BySource` (Task 7) ✓
- Global filter bar applied to every pivot page → via `filteredData` in App.tsx (Task 8) ✓
- Shared pivot table + chart components → Tasks 4, 5, 6 ✓
- Plan 1 follow-up #1 (fixture test) → Task 1 ✓
- Plan 1 follow-up #3 (empty-state UX) → Task 2 + used in `PivotView` ✓

**2. Placeholder scan:** no TBD / TODO / "handle edge cases" — every step has concrete code or concrete commands with expected output.

**3. Type consistency:**
- `PivotRow` declared in Task 3 is consumed byte-identically in Tasks 4, 5, 6.
- `PivotKey = keyof PerformanceRecord` in Task 3 — downstream `groupBy` props in Tasks 6-7 type against this.
- `chartKind: 'time' | 'categorical'` in Task 5 matches `PivotChart` in Task 6 and the page props in Task 7.
- Sidebar `TABS` id strings (`'ByMonth'`, `'ByCountry'`, `'ByBrand'`, `'BySource'`) match the `activeTab === '...'` checks in App.tsx Task 8 exactly.
- Lucide icons (`CalendarDays`, `Globe`, `Tag`, `Link`) added to both Sidebar and App.tsx imports in Task 8.
