# Period Cohort + Polish Pass — Implementation Plan (Plan 4 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Excel-parity roadmap with three pillars:
1. **Bundle audit + lazy-load the xlsx dependency** — the 1.4 MB initial bundle has been firing Vite's chunk-size warning since before Plan 1. xlsx alone is ~400 KB and only runs at upload time; dynamic-importing it collapses the initial bundle dramatically.
2. **Period cohort feature** — a cohort ladder chart that answers "for the FTDs we acquired in month X, how much deposits / NGR / profit did we earn in period 0, 1, 2, …?" This is the one view the ROI workbook's Period field enables but no existing page uses.
3. **Polish pass** — one commit each for the five small debts tracked in memory (pivot/profile UI tests, PivotTable type tightening, dead media query, ROI formatting inconsistency, selectedPartnerId hygiene).

**Architecture:**
- Bundle work is non-invasive: `rollup-plugin-visualizer` added as a devDep; `XLSX` switched from a static top-of-file import to a dynamic `await import('xlsx')` inside `parseExcelFile`. The fixture test keeps its static import (test-time only, not part of production bundle).
- Cohort feature follows the same pattern as Plan 2's pivots: a pure `cohortAggregate(data, opts)` function + a reusable `CohortChart` recharts component + a thin `Cohort` page that composes them.
- Cohort data shape is pivot-denormalized: `{ period: N, '2025-01': M, '2025-02': M, … }[]` — one array entry per Period value, one column per cohort-start month. This is recharts-idiomatic for multi-line charts.
- The polish pass is five small, atomic commits so git bisect stays clean if any change regresses.

**Tech Stack:** React 19, TypeScript 6, Vite 8, vitest 4, recharts, lucide-react. One new devDep (`rollup-plugin-visualizer`). One new test dep if missing (`@testing-library/react` — already present in Plan 1's devDeps, no new install).

**Scope boundary — what this plan does NOT do:**
- No full per-route code splitting via `React.lazy()` — the xlsx dynamic import likely gets us under the 500 KB threshold; if it doesn't, we revisit with a dedicated follow-up. Lazy-loading every page adds complexity we don't need.
- No surfacing of `%Bonus` / `%Cashout` in the pivot tables — those require persisting `casino_bonuses`, `sb_bonuses`, `cashouts_sum` columns (schema + parser + kpiEngine changes). Track as a post-Plan-4 follow-up if the client requests it.
- No new filter dimensions — Period is already a filter dim from Plan 1.
- No backend AskAI changes — the cohort view is frontend-only aggregation.

**Follow-ups addressed in this plan (from memory):**
- **#2** Bundle audit → Task 1 ✓
- **#4** Pivot/Profile UI click-path tests → Task 5 ✓
- **#5** PivotTable type tightening + dead media query → Task 6 ✓
- **#6** ROI formatting consistency → Task 6 ✓
- **#8** selectedPartnerId lingering after tab switch → Task 6 ✓
- **#7** KPI grid extraction — intentionally deferred (low value, medium risk of visual regression).

---

## File Structure

**New files:**
- `frontend/src/utils/cohortAggregate.ts` — pure function: `(data, opts) → { periods: number[], cohorts: string[], chartData: Record<string, number>[] }`
- `frontend/src/utils/__tests__/cohortAggregate.test.ts`
- `frontend/src/components/CohortChart.tsx` — multi-line recharts chart
- `frontend/src/components/CohortChart.css`
- `frontend/src/pages/Cohort.tsx` — page composition: header + chart + `NoMatchingRows` fallback
- `frontend/src/components/__tests__/PivotTable.test.tsx` — UI click-path tests (sort toggle)
- `frontend/src/components/__tests__/NoMatchingRows.test.tsx` — UI click-path tests (reset button)

**Modified files:**
- `frontend/package.json` / `package-lock.json` — adds `rollup-plugin-visualizer` devDep
- `frontend/vite.config.ts` — wires the visualizer plugin
- `frontend/src/utils/excelParser.ts` — dynamic-import `xlsx`
- `frontend/src/App.tsx` — register `Cohort` page + tab; clear `selectedPartnerId` in `switchTab` when navigating away from the profile
- `frontend/src/components/Sidebar.tsx` — add `Cohort` nav entry
- `frontend/src/components/PivotView/PivotView.css` — drop the no-op `@media (min-width: 1100px)` block
- `frontend/src/components/PivotView/PivotTable.tsx` — tighten sort types (no more `as any`); standardize ROI formatting
- `frontend/src/pages/Overview.tsx` — align ROI formatting
- `frontend/src/pages/AffiliateProfile.tsx` — align ROI formatting

---

## Task 1: Bundle audit + dynamic-import `xlsx`

**Files:**
- Modify: `frontend/package.json` (devDep)
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/utils/excelParser.ts`

- [ ] **Step 1: Install the visualizer**

```bash
npm install -D rollup-plugin-visualizer
```

(CWD is `frontend/`.)

- [ ] **Step 2: Wire the plugin in vite.config.ts**

Read `frontend/vite.config.ts` first. Add a `visualizer` import and include it in the `plugins` array. Example shape (adapt to existing file structure):

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    }),
  ],
});
```

If the file already has other config (css / server / etc.), preserve it. Only add the import and the plugins entry.

- [ ] **Step 3: Dynamic-import xlsx inside `parseExcelFile`**

Open `frontend/src/utils/excelParser.ts`. Find the top-of-file static import:

```ts
import * as XLSX from 'xlsx';
```

**Delete that line.** Then inside `parseExcelFile`, at the top of the `new Promise` executor (before `reader.onload = ...`), add a dynamic import that resolves to the same shape:

```ts
export const parseExcelFile = async (file: File): Promise<any[]> => {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(data), {
          type: 'array',
          cellDates: true,
          dateNF: 'yyyy-mm-dd',
        });
        // … rest of the body unchanged
```

Preserve everything inside the promise exactly. The only change is the top-level `import` → an `await import` bound to a local `XLSX` variable. The `XLSX.read`, `XLSX.utils.sheet_to_json` calls inside still work because `import()` returns the same namespace object shape.

**Important:** do NOT touch the fixture test (`frontend/src/utils/__tests__/excelParser.fixture.test.ts`). Its `import * as XLSX from 'xlsx'` at the top is fine — vitest runs it at test time, outside the production bundle.

- [ ] **Step 4: Build and measure**

Run: `npm run build`
Expected: clean. After build, `dist/` contains `stats.html`, an `index-<hash>.js` main bundle, and a separate `xlsx-<hash>.js` chunk. The main bundle size should drop by roughly 400 KB (the xlsx share).

Record the new main-bundle size in your commit body so we have before/after context.

Run: `npm test`
Expected: 39 passing + 0 todos — no regressions. The fixture test still works because it imports `xlsx` directly, not through `parseExcelFile`'s dynamic path.

- [ ] **Step 5: Commit on `dev`**

```bash
git add package.json package-lock.json vite.config.ts src/utils/excelParser.ts
git commit -m "perf(bundle): dynamic-import xlsx; add rollup-plugin-visualizer"
```

The commit body should include the before/after main-bundle sizes.

---

## Task 2: `cohortAggregate` pure function (TDD)

**Files:**
- Create: `frontend/src/utils/cohortAggregate.ts`
- Create: `frontend/src/utils/__tests__/cohortAggregate.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/utils/__tests__/cohortAggregate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cohortAggregate } from '../cohortAggregate';
import type { PerformanceRecord } from '../kpiEngine';

const data: PerformanceRecord[] = [
  // cohort 2026-01: periods 0, 1, 2
  { ftd_month: '2026-01', period: 0, revenue: 100, ftds: 5, casino_real_ngr: 60, sb_real_ngr: 0, cost: 40, flats_and_adjustments: 0 },
  { ftd_month: '2026-01', period: 1, revenue: 80,  ftds: 0, casino_real_ngr: 50, sb_real_ngr: 0, cost: 10, flats_and_adjustments: 0 },
  { ftd_month: '2026-01', period: 2, revenue: 40,  ftds: 0, casino_real_ngr: 25, sb_real_ngr: 0, cost: 5,  flats_and_adjustments: 0 },
  // cohort 2026-02: periods 0, 1
  { ftd_month: '2026-02', period: 0, revenue: 200, ftds: 8, casino_real_ngr: 120, sb_real_ngr: 0, cost: 80, flats_and_adjustments: 0 },
  { ftd_month: '2026-02', period: 1, revenue: 150, ftds: 0, casino_real_ngr: 90, sb_real_ngr: 0, cost: 20, flats_and_adjustments: 0 },
];

describe('cohortAggregate', () => {
  it('returns ascending periods and alphabetical cohorts for revenue metric', () => {
    const out = cohortAggregate(data, { metric: 'revenue' });
    expect(out.periods).toEqual([0, 1, 2]);
    expect(out.cohorts).toEqual(['2026-01', '2026-02']);
  });

  it('chartData has one row per period with cohort columns filled where data exists', () => {
    const out = cohortAggregate(data, { metric: 'revenue' });
    expect(out.chartData).toEqual([
      { period: 0, '2026-01': 100, '2026-02': 200 },
      { period: 1, '2026-01': 80,  '2026-02': 150 },
      { period: 2, '2026-01': 40 },   // 2026-02 absent from period 2 → column missing (null-safe for recharts)
    ]);
  });

  it('supports ftds metric', () => {
    const out = cohortAggregate(data, { metric: 'ftds' });
    expect(out.chartData[0]).toEqual({ period: 0, '2026-01': 5, '2026-02': 8 });
  });

  it('supports profit = revenue - cost', () => {
    const out = cohortAggregate(data, { metric: 'profit' });
    expect(out.chartData[0]).toEqual({ period: 0, '2026-01': 60, '2026-02': 120 });
  });

  it('supports ngr = casino_real_ngr + sb_real_ngr', () => {
    const out = cohortAggregate(data, { metric: 'ngr' });
    expect(out.chartData[0]).toEqual({ period: 0, '2026-01': 60, '2026-02': 120 });
  });

  it('coerces period values that arrive as strings', () => {
    const mixed: PerformanceRecord[] = [
      { ftd_month: '2026-01', period: '0' as unknown as number, revenue: 10 },
      { ftd_month: '2026-01', period: '1' as unknown as number, revenue: 5  },
    ];
    const out = cohortAggregate(mixed, { metric: 'revenue' });
    expect(out.periods).toEqual([0, 1]);
    expect(out.chartData[0]).toEqual({ period: 0, '2026-01': 10 });
  });

  it('omits rows with null/empty ftd_month or non-numeric period', () => {
    const dirty: PerformanceRecord[] = [
      ...data,
      { ftd_month: '', period: 0, revenue: 999 },
      { ftd_month: '2026-03', period: 'N/A' as unknown as number, revenue: 999 },
    ];
    const out = cohortAggregate(dirty, { metric: 'revenue' });
    expect(out.cohorts).toEqual(['2026-01', '2026-02']); // 2026-03 row skipped (non-numeric period)
  });

  it('returns empty shape on empty input', () => {
    expect(cohortAggregate([], { metric: 'revenue' })).toEqual({
      periods: [],
      cohorts: [],
      chartData: [],
    });
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- cohortAggregate`
Expected: all 8 tests fail with "Failed to resolve import '../cohortAggregate'".

- [ ] **Step 3: Implement**

Create `frontend/src/utils/cohortAggregate.ts`:

```ts
import type { PerformanceRecord } from './kpiEngine';

export type CohortMetric = 'revenue' | 'ftds' | 'profit' | 'ngr' | 'cost';

export interface CohortAggregate {
  periods:   number[];                          // sorted ascending, e.g. [0, 1, 2, 3]
  cohorts:   string[];                          // sorted alphabetically, e.g. ['2026-01', '2026-02']
  chartData: Record<string, number>[];          // one entry per period: { period, [cohort]: value, ... }
}

interface Opts { metric: CohortMetric; }

function valueOf(row: PerformanceRecord, metric: CohortMetric): number {
  const rev  = Number(row.revenue) || 0;
  const cost = Number(row.cost)    || 0;
  switch (metric) {
    case 'revenue': return rev;
    case 'cost':    return cost;
    case 'profit':  return rev - cost;
    case 'ftds':    return Number(row.ftds) || 0;
    case 'ngr':     return (Number(row.casino_real_ngr) || 0) + (Number(row.sb_real_ngr) || 0);
  }
}

/**
 * Cohort-ladder aggregation: for each (ftd_month, period) pair, sum the chosen
 * metric, then pivot so the result can feed a recharts LineChart directly —
 * one data entry per period, one series per cohort.
 *
 * Rows are skipped when `ftd_month` is blank or `period` cannot be coerced
 * to a finite number.
 */
export function cohortAggregate(data: PerformanceRecord[], opts: Opts): CohortAggregate {
  const buckets = new Map<string, Map<number, number>>();
  const cohortSet  = new Set<string>();
  const periodSet  = new Set<number>();

  for (const row of data) {
    const cohort = String(row.ftd_month ?? '').trim();
    if (!cohort) continue;
    const periodNum = Number(row.period);
    if (!Number.isFinite(periodNum)) continue;

    cohortSet.add(cohort);
    periodSet.add(periodNum);

    if (!buckets.has(cohort)) buckets.set(cohort, new Map());
    const inner = buckets.get(cohort)!;
    inner.set(periodNum, (inner.get(periodNum) ?? 0) + valueOf(row, opts.metric));
  }

  const periods = [...periodSet].sort((a, b) => a - b);
  const cohorts = [...cohortSet].sort();

  const chartData = periods.map(period => {
    const entry: Record<string, number> = { period };
    for (const cohort of cohorts) {
      const v = buckets.get(cohort)?.get(period);
      if (v !== undefined) entry[cohort] = v;
    }
    return entry;
  });

  return { periods, cohorts, chartData };
}
```

- [ ] **Step 4: Tests pass**

Run: `npm test -- cohortAggregate`
Expected: all 8 tests pass.

Run full suite: `npm test`
Expected: 47 passing + 0 todos (was 39; gained 8 from cohortAggregate).

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/utils/cohortAggregate.ts src/utils/__tests__/cohortAggregate.test.ts
git commit -m "feat(cohort): add cohortAggregate pure function with TDD"
```

---

## Task 3: `CohortChart` component

**Files:**
- Create: `frontend/src/components/CohortChart.tsx`
- Create: `frontend/src/components/CohortChart.css`

- [ ] **Step 1: Implement the component**

Create `frontend/src/components/CohortChart.tsx`:

```tsx
import { useChartColors } from '../lib/theme';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { CohortAggregate, CohortMetric } from '../utils/cohortAggregate';
import './CohortChart.css';

interface Props {
  aggregate: CohortAggregate;
  metric:    CohortMetric;
}

const COLORS = [
  '#00d4ff', '#818cf8', '#10b981', '#f0b429', '#ef4444', '#ec4899',
  '#f97316', '#a78bfa', '#34d399', '#fbbf24', '#6366f1', '#22d3ee',
  '#f472b6', '#84cc16', '#facc15', '#06b6d4',
];

const metricLabel = (m: CohortMetric) => {
  switch (m) {
    case 'revenue': return 'Deposits Sum';
    case 'ftds':    return 'FTD';
    case 'profit':  return 'Profit';
    case 'ngr':     return 'NGR';
    case 'cost':    return 'Partner Income';
  }
};

const formatValue = (v: number, metric: CohortMetric) => {
  if (metric === 'ftds') return new Intl.NumberFormat('en-US').format(v);
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `€${(v / 1_000).toFixed(0)}k`;
  return `€${Math.round(v)}`;
};

export function CohortChart({ aggregate, metric }: Props) {
  const { axisColor, axisStroke, tooltipStyle } = useChartColors();
  const { cohorts, chartData } = aggregate;

  return (
    <div className="cohort-chart">
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <XAxis
            dataKey="period"
            type="number"
            domain={[0, 'dataMax']}
            stroke={axisStroke}
            tick={{ fontSize: 11, fill: axisColor }}
            label={{ value: 'Period (months since FTD)', position: 'insideBottom', offset: -2, fill: axisColor, fontSize: 11 }}
          />
          <YAxis
            stroke={axisStroke}
            tick={{ fontSize: 11, fill: axisColor }}
            tickFormatter={v => formatValue(Number(v), metric)}
            label={{ value: metricLabel(metric), angle: -90, position: 'insideLeft', fill: axisColor, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => formatValue(Number(v), metric)}
          />
          <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: 8 }} />
          {cohorts.map((cohort, i) => (
            <Line
              key={cohort}
              type="monotone"
              dataKey={cohort}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={1.5}
              dot={{ r: 2 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Add styles**

Create `frontend/src/components/CohortChart.css`:

```css
.cohort-chart {
  padding: 12px 6px 4px;
  font-family: var(--font-body);
}
```

- [ ] **Step 3: Build + test**

Run: `npm run build` — clean.
Run: `npm test` — 47 passing.

- [ ] **Step 4: Commit**

```bash
git add src/components/CohortChart.tsx src/components/CohortChart.css
git commit -m "feat(cohort): add CohortChart multi-line recharts component"
```

---

## Task 4: `Cohort` page + sidebar wiring

**Files:**
- Create: `frontend/src/pages/Cohort.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Create the page**

Create `frontend/src/pages/Cohort.tsx`:

```tsx
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
  if (data.length === 0) return <NoMatchingRows entity="cohort rows" />;

  const [metric, setMetric] = useState<CohortMetric>('revenue');
  const aggregate = useMemo(() => cohortAggregate(data, { metric }), [data, metric]);

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
```

**Note on the empty-state short-circuit:** the `if (data.length === 0)` guard comes BEFORE any hook calls. That's intentional and valid — a component can early-return with NO hooks called on this render, as long as it also calls NO hooks on this render. Since `useState`/`useMemo` only run when we reach the main body below the guard, this is hook-safe. (This pattern is already used in Overview.tsx after Plan 3 Task 6.)

Wait — re-reading the pattern, Overview keeps `useChartColors()` above the guard. Match that: move the early return BELOW the two hook calls. Reorder so:

```tsx
export const Cohort: React.FC<{ data: PerformanceRecord[] }> = ({ data }) => {
  const [metric, setMetric] = useState<CohortMetric>('revenue');
  const aggregate = useMemo(() => cohortAggregate(data, { metric }), [data, metric]);

  if (data.length === 0) return <NoMatchingRows entity="cohort rows" />;

  return (
    // … rest of the body
  );
};
```

Use that ordering in the created file — hooks above the guard. This keeps the React rules-of-hooks invariant cleanly satisfied (all hooks called unconditionally on every render).

- [ ] **Step 2: Register the page in App.tsx**

Open `frontend/src/App.tsx`. Add after the existing Plan 3 `AffiliateProfile` import:

```ts
import { Cohort } from './pages/Cohort';
```

Find the lucide-react import line and add `Layers` to it (for the sidebar icon):

```ts
import { BarChart3, LayoutDashboard, Users, Megaphone, Lightbulb, Table, Menu, Trash2, Sparkles, CalendarDays, Globe, Tag, Link, Layers } from 'lucide-react';
```

(Formatting may span multiple lines in the actual file — preserve whatever style is there; just include `Layers` in the list.)

Extend the top-level `TABS` constant. Insert a new entry between `BySource` and `Affiliates`:

```ts
  { id: 'Cohort',     label: 'Cohort',     Icon: Layers          },
```

So the array becomes:

```ts
const TABS = [
  { id: 'Overview',   label: 'Overview',   Icon: LayoutDashboard },
  { id: 'AskAI',      label: 'Ask AI',     Icon: Sparkles        },
  { id: 'ByMonth',    label: 'By Month',   Icon: CalendarDays    },
  { id: 'ByCountry',  label: 'By Country', Icon: Globe           },
  { id: 'ByBrand',    label: 'By Brand',   Icon: Tag             },
  { id: 'BySource',   label: 'By Source',  Icon: Link            },
  { id: 'Cohort',     label: 'Cohort',     Icon: Layers          },
  { id: 'Affiliates', label: 'Affiliates', Icon: Users           },
  { id: 'Campaigns',  label: 'Campaigns',  Icon: Megaphone       },
  { id: 'Insights',   label: 'Insights',   Icon: Lightbulb       },
  { id: 'Data',       label: 'Data',       Icon: Table           },
  { id: 'Deleted',    label: 'Deleted',    Icon: Trash2          },
];
```

In the page-rendering branch inside `AppShell`, add a new line between `BySource` and `Affiliates`:

```tsx
            {activeTab === 'BySource'   && <BySource   data={filteredData} />}
            {activeTab === 'Cohort'     && <Cohort     data={filteredData} />}
            {activeTab === 'Affiliates' && <Affiliates data={filteredData} onPartnerClick={openAffiliateProfile} />}
```

- [ ] **Step 3: Mirror in Sidebar.tsx**

Open `frontend/src/components/Sidebar.tsx`. Add `Layers` to the lucide-react import. Extend the local `TABS` constant the same way — insert `{ id: 'Cohort', label: 'Cohort', Icon: Layers }` between `BySource` and `Affiliates`.

- [ ] **Step 4: Build + test**

Run: `npm run build` — clean.
Run: `npm test` — 47 passing.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Cohort.tsx src/App.tsx src/components/Sidebar.tsx
git commit -m "feat(cohort): add Cohort page with metric selector and sidebar wiring"
```

---

## Task 5: UI click-path tests (follow-up #4)

**Files:**
- Create: `frontend/src/components/__tests__/PivotTable.test.tsx`
- Create: `frontend/src/components/__tests__/NoMatchingRows.test.tsx`

- [ ] **Step 1: PivotTable sort test**

Create `frontend/src/components/__tests__/PivotTable.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PivotTable } from '../PivotView/PivotTable';
import type { PivotRow } from '../../utils/pivotAggregate';
import { processKPIs } from '../../utils/kpiEngine';

afterEach(cleanup);

function row(key: string, revenue: number, ftds: number): PivotRow {
  const fakeData = [{ revenue, ftds, cost: 0, casino_real_ngr: 0, sb_real_ngr: 0, flats_and_adjustments: 0, clicks: 0, registrations: 0 }];
  return { key, count: 1, kpis: processKPIs(fakeData) };
}

describe('PivotTable', () => {
  const rows: PivotRow[] = [
    row('A', 100, 1),
    row('B', 300, 3),
    row('C', 200, 2),
  ];

  it('defaults to sorting by revenue desc', () => {
    render(<PivotTable rowLabel="Key" rows={rows} data={[]} />);
    const tbody = screen.getAllByRole('rowgroup')[0]; // thead=0, tbody=1 in render order? actually tbody is 1 in DOM but role-wise: <thead><tbody><tfoot> → three rowgroups. tbody is index 1.
    const tbodyRows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
    expect(tbodyRows[0].textContent?.startsWith('B')).toBe(true);
    expect(tbodyRows[1].textContent?.startsWith('C')).toBe(true);
    expect(tbodyRows[2].textContent?.startsWith('A')).toBe(true);
  });

  it('toggles sort direction when the same header is clicked twice', async () => {
    const user = userEvent.setup();
    render(<PivotTable rowLabel="Key" rows={rows} data={[]} />);

    // First click on Deposits flips from initial desc → asc.
    await user.click(screen.getByText('Deposits'));
    let tbodyRows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
    expect(tbodyRows[0].textContent?.startsWith('A')).toBe(true);

    // Second click flips back to desc.
    await user.click(screen.getByText('Deposits'));
    tbodyRows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
    expect(tbodyRows[0].textContent?.startsWith('B')).toBe(true);
  });

  it('sorts alphabetically ascending when the Key header is clicked', async () => {
    const user = userEvent.setup();
    render(<PivotTable rowLabel="Key" rows={rows} data={[]} />);
    await user.click(screen.getByText('Key'));
    const tbodyRows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
    expect(tbodyRows[0].textContent?.startsWith('A')).toBe(true);
    expect(tbodyRows[2].textContent?.startsWith('C')).toBe(true);
  });
});
```

- [ ] **Step 2: NoMatchingRows reset test**

Create `frontend/src/components/__tests__/NoMatchingRows.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoMatchingRows } from '../NoMatchingRows';
import { FilterProvider, useFilters } from '../../contexts/FilterContext';

afterEach(cleanup);

function TestHarness({ initialSearch = '' }: { initialSearch?: string }) {
  // A tiny helper that seeds an active filter so activeCount > 0,
  // then reads it after reset via useFilters to assert the reset fired.
  return (
    <FilterProvider>
      <Seeder initialSearch={initialSearch} />
      <NoMatchingRows entity="things" />
    </FilterProvider>
  );
}

function Seeder({ initialSearch }: { initialSearch: string }) {
  const { filters, updateFilter } = useFilters();
  if (initialSearch && filters.searchTerm !== initialSearch) {
    // Schedule the update so it runs once after mount, not during render.
    queueMicrotask(() => updateFilter('searchTerm', initialSearch));
  }
  return <div data-testid="seeder-search">{filters.searchTerm}</div>;
}

describe('NoMatchingRows', () => {
  it('pluralizes "filters are active" correctly', async () => {
    render(<TestHarness initialSearch="acme" />);
    // Wait for the seed to apply
    await screen.findByText('acme');
    expect(screen.getByText(/1 filter is active/i)).toBeTruthy();
    expect(screen.getByText(/No things match the current filters/i)).toBeTruthy();
  });

  it('clears the filter state when Clear all filters is clicked', async () => {
    const user = userEvent.setup();
    render(<TestHarness initialSearch="acme" />);
    await screen.findByText('acme');

    await user.click(screen.getByRole('button', { name: /Clear all filters/i }));

    // After reset, the seeded search term should be empty.
    expect(screen.getByTestId('seeder-search').textContent).toBe('');
  });
});
```

- [ ] **Step 3: Check `@testing-library/user-event` is installed**

Check `frontend/package.json`. If `@testing-library/user-event` is absent from `devDependencies`, install it:

```bash
npm install -D @testing-library/user-event
```

(`@testing-library/react` and `@testing-library/jest-dom` are already present per Plan 1's devDeps.)

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 47 existing + 3 PivotTable + 2 NoMatchingRows = **52 passing**, 0 todos.

If any test fails, investigate the DOM shape — the role-based queries assume the standard browser-level roles for `<table><thead><tbody><tfoot>`. If vitest's jsdom version exposes the rowgroups differently, adjust to `getByRole('table')` + manual child traversal instead.

Run: `npm run build` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/__tests__/PivotTable.test.tsx src/components/__tests__/NoMatchingRows.test.tsx package.json package-lock.json
git commit -m "test(ui): add PivotTable sort and NoMatchingRows reset click-path tests"
```

---

## Task 6: Polish pass (#5, #6, #8)

Four small, atomic edits in one commit. Each is a few lines — simpler to group than to split since they're unrelated to each other semantically.

**Files:**
- Modify: `frontend/src/components/PivotView/PivotView.css` (drop dead media query)
- Modify: `frontend/src/components/PivotView/PivotTable.tsx` (sort type tightening + ROI format)
- Modify: `frontend/src/pages/Overview.tsx` (ROI format)
- Modify: `frontend/src/pages/AffiliateProfile.tsx` (ROI format already 2dp, leave alone; verify)
- Modify: `frontend/src/App.tsx` (clear selectedPartnerId in switchTab)

- [ ] **Step 1: Drop the dead media query in PivotView.css**

Open `frontend/src/components/PivotView/PivotView.css`. Find the `@media (min-width: 1100px)` block:

```css
@media (min-width: 1100px) {
  .pivot-view {
    grid-template-columns: 1fr;
  }
}
```

Delete the entire block (it's a no-op override — both rules set `1fr`).

- [ ] **Step 2: Tighten PivotTable sort types**

Open `frontend/src/components/PivotView/PivotTable.tsx`. Find the `sorted` useMemo (around lines 30-40):

```tsx
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = sortKey === 'key' ? a.key : sortKey === 'count' ? a.count : (a.kpis as any)[sortKey];
      const bv = sortKey === 'key' ? b.key : sortKey === 'count' ? b.count : (b.kpis as any)[sortKey];
      // …
```

Replace the two `(a.kpis as any)[sortKey]` / `(b.kpis as any)[sortKey]` casts with a typed lookup. The trick: `SortKey` is the closed union `'key' | 'count' | ...numeric metrics...`. After narrowing away `'key'` and `'count'`, the remaining keys (`revenue | cost | profit | roi | ftds | adpu | arpu | ecpa`) are guaranteed-numeric fields on `processKPIs`'s return type.

Replace the sort comparator with:

```tsx
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === 'key') {
        return sortDir === 'asc' ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key);
      }
      const pick = (r: PivotRow): number =>
        sortKey === 'count' ? r.count : (r.kpis[sortKey as Exclude<SortKey, 'key' | 'count'>] as number);
      const av = pick(a);
      const bv = pick(b);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, sortDir]);
```

Remove the fallback `String(av ?? '')` branch — it's unreachable now that the type system enforces that only `'key'` yields strings and everything else yields numbers.

**In the same file**, find `formatRoi`:

```tsx
const formatRoi = (v: number) => v.toFixed(2);
```

Leave it — it's already 2dp, matching AffiliateProfile and the polish target.

- [ ] **Step 3: Align ROI formatting in Overview.tsx**

Open `frontend/src/pages/Overview.tsx`. Find the ROI KPICard (around line 112-116):

```tsx
        <KPICard label="ROI"       value={kpis.roi.toFixed(1)}          color="#818cf8" icon={<Percent         size={15} />} />
```

Change `toFixed(1)` to `toFixed(2)` so the three surfaces (Overview card, AffiliateProfile card, PivotTable totals) all match.

- [ ] **Step 4: Verify AffiliateProfile ROI is already 2dp**

Open `frontend/src/pages/AffiliateProfile.tsx`. Confirm the ROI KPICard uses `kpis.roi.toFixed(2)`. If not, update to match. (After Plan 3 it should already be 2dp; if it's 1, change it.)

- [ ] **Step 5: Clear `selectedPartnerId` in `switchTab`**

Open `frontend/src/App.tsx`. Find `switchTab`:

```tsx
  const switchTab = (tab: string) => { setActiveTab(tab); setSidebarOpen(false); };
```

Replace with:

```tsx
  const switchTab = (tab: string) => {
    if (tab !== 'AffiliateProfile') setSelectedPartnerId(null);
    setActiveTab(tab);
    setSidebarOpen(false);
  };
```

This clears the lingering partner id whenever the user navigates away from the profile via any sidebar / bottom-nav click. Re-entering the profile via Affiliates row click still works because `openAffiliateProfile` sets the id before flipping the tab.

- [ ] **Step 6: Build + test**

Run: `npm run build` — clean.
Run: `npm test` — 52 passing.

- [ ] **Step 7: Commit**

```bash
git add src/components/PivotView/PivotView.css src/components/PivotView/PivotTable.tsx src/pages/Overview.tsx src/pages/AffiliateProfile.tsx src/App.tsx
git commit -m "chore(polish): align ROI format, tighten PivotTable sort, drop dead media query, clear selectedPartnerId"
```

---

## Self-Review Notes

**1. Spec coverage:**
- Bundle audit → Task 1 ✓
- xlsx dynamic import → Task 1 ✓
- Cohort feature (aggregate + chart + page + nav) → Tasks 2, 3, 4 ✓
- UI click-path tests (PivotTable + NoMatchingRows) → Task 5 ✓
- PivotTable sort type tightening → Task 6 ✓
- Dead media query removal → Task 6 ✓
- ROI formatting consistency → Task 6 ✓
- `selectedPartnerId` tab-switch cleanup → Task 6 ✓
- Memory follow-up #7 (KPI grid extraction) → explicitly out of scope

**2. Placeholder scan:** no TBD / "handle edge cases" / "similar to Task N" — every step has concrete code or concrete commands.

**3. Type consistency:**
- `CohortMetric` union in Task 2 is consumed byte-identically in Tasks 3 and 4.
- `CohortAggregate` shape in Task 2 matches `CohortChart` prop in Task 3 and the aggregate usage in Task 4.
- `'Cohort'` tab id is added to both App.tsx `TABS` and Sidebar `TABS` in Task 4, with the same label and icon.
- `SortKey` type in Task 6's PivotTable tightening is the same union already declared at `PivotTable.tsx:17-19`.
- `Layers` lucide icon is added to both App.tsx and Sidebar.tsx imports in Task 4.

**4. Cross-task ordering invariants:**
- Task 1 must land before Task 5 so the new test files benefit from whatever chunking the visualizer configuration produces.
- Task 2 must land before Tasks 3 and 4 (they depend on `cohortAggregate`).
- Task 4 depends on Task 3 (`CohortChart` import).
- Task 6 is last since it touches files that earlier tasks may have modified (Overview, AffiliateProfile).
