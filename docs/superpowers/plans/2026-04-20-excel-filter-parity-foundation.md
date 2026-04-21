# Excel Filter-Parity Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the React dashboard filter like the ROI Excel workbook — one shared filter bar (Partner_ID, Brand, Company_name, AM, Source, Player_country, Period, FD_Date, problematic_source) applied to every page — laying the data-model and UI foundations for Plans 2–4 (pivot views, affiliate profile, cohort + computed measures).

**Architecture:**
- The React SPA already filters client-side: `App.tsx` loads all `performance_records` from Supabase into memory and passes the full array to each page. We extend that pipeline by adding a `FilterContext` + `applyFilters()` that lives between `App.tsx` and the pages — pages receive pre-filtered data with no changes to their internal logic.
- The Supabase schema gains three new columns (`company_name`, `player_country`, `problematic_source`) plus a generated `ftd_month`. The backend `Filters` type (used only by AskAI) is updated in lockstep so AskAI queries the same dimensions.
- The Excel parser (`parseExcelFile`) is the ingestion surface — we extend its column aliases so uploaded workbooks populate the new fields without re-building the ETL.
- The Streamlit app (`app.py`) is **not** updated. React is canonical; `app.py` is legacy and out of scope for this plan.

**Tech Stack:** React 19, TypeScript 6, Vite 8, vitest 4, recharts, Supabase JS client, xlsx 0.18. Backend (AskAI only) is Node + pg + Anthropic SDK in `api/_lib/`.

**Scope boundary — what this plan does NOT do:**
- No pivot-by-dimension views (Plan 2).
- No `/affiliates/:partnerId` detail page (Plan 3).
- No Period cohort chart or new computed measures surfaced (Plan 4).
- No backfill of existing rows for the new columns — users re-upload the workbook after migration; `replaceRecords()` already does a delete-then-insert cycle, so re-upload repopulates cleanly.

---

## File Structure

**New files:**
- `db/migrations/20260420_06_filter_parity_columns.sql` — schema migration
- `frontend/src/utils/applyFilters.ts` — pure function: `(data, filters) → filteredData`
- `frontend/src/utils/__tests__/applyFilters.test.ts`
- `frontend/src/utils/__tests__/excelParser.test.ts` (first tests for the parser)
- `frontend/src/contexts/FilterContext.tsx` — provider + `useFilters()` hook
- `frontend/src/components/FilterBar/FilterBar.tsx` — horizontal bar composing dropdowns + chips
- `frontend/src/components/FilterBar/FilterDropdown.tsx` — multi-select with search + "All"
- `frontend/src/components/FilterBar/ActiveFilterChips.tsx` — removable chips for active values
- `frontend/src/components/FilterBar/FilterBar.css` — scoped styles
- `api/_lib/__tests__/filters.test.ts` — tests for `buildWhereClause` with new keys

**Modified files:**
- `supabase-setup.sql` — add new columns so fresh setups match (keep in sync with migration 06)
- `frontend/src/utils/kpiEngine.ts` — extend `PerformanceRecord` interface
- `frontend/src/lib/db.ts` — extend `COLUMNS` constant
- `frontend/src/utils/excelParser.ts` — extend `COLUMN_ALIASES`, add `ftd_month` derivation, preserve `company_name` separately from `affiliate_name`
- `frontend/src/types/filters.ts` — extend `GlobalFilters` interface with the new dimensions and date range semantics
- `frontend/src/App.tsx` — wrap in `<FilterProvider>`, render `<FilterBar>`, pass `filteredData` to pages
- `api/_lib/types.ts` — add `company_name`, `player_country`, `problematic_source` to `Dim` and `Filters`
- `api/_lib/tools/_filters.ts` — add the new keys to `ALLOWED_DIMS` and `ALLOWED_FILTER_KEYS`

---

## Task 1: Database migration — add filter-parity columns

**Files:**
- Create: `db/migrations/20260420_06_filter_parity_columns.sql`
- Modify: `supabase-setup.sql`

- [ ] **Step 1: Write the migration SQL**

Create `db/migrations/20260420_06_filter_parity_columns.sql`:

```sql
-- 20260420_06_filter_parity_columns.sql
-- Adds columns required to reach Excel ROI workbook filter parity.
-- Apply by pasting into the Supabase SQL Editor.

ALTER TABLE public.performance_records
  ADD COLUMN IF NOT EXISTS company_name        text,
  ADD COLUMN IF NOT EXISTS player_country      text,
  ADD COLUMN IF NOT EXISTS problematic_source  smallint,
  ADD COLUMN IF NOT EXISTS ftd_month           text;

CREATE INDEX IF NOT EXISTS idx_perf_company_name       ON public.performance_records (company_name);
CREATE INDEX IF NOT EXISTS idx_perf_player_country     ON public.performance_records (player_country);
CREATE INDEX IF NOT EXISTS idx_perf_problematic_source ON public.performance_records (problematic_source);
CREATE INDEX IF NOT EXISTS idx_perf_ftd_month          ON public.performance_records (ftd_month);
CREATE INDEX IF NOT EXISTS idx_perf_am                 ON public.performance_records (am);
CREATE INDEX IF NOT EXISTS idx_perf_source             ON public.performance_records (source);
CREATE INDEX IF NOT EXISTS idx_perf_period             ON public.performance_records (period);
```

- [ ] **Step 2: Keep `supabase-setup.sql` in sync**

Edit `supabase-setup.sql` — replace the column block inside `CREATE TABLE IF NOT EXISTS public.performance_records` so new setups include the new columns:

```sql
CREATE TABLE IF NOT EXISTS public.performance_records (
  id                    bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  affiliate_id          text,
  affiliate_name        text,
  company_name          text,
  country               text,
  player_country        text,
  campaign              text,
  brand                 text,
  am                    text,
  source                text,
  problematic_source    smallint,
  period                text,
  date                  text,
  ftd_month             text,
  clicks                numeric,
  registrations         numeric,
  ftds                  numeric,
  revenue               numeric,
  cost                  numeric,
  casino_real_ngr       numeric,
  sb_real_ngr           numeric,
  flats_and_adjustments numeric,
  created_at            timestamptz   DEFAULT now()
);
```

Also add these CREATE INDEX lines at the bottom of `supabase-setup.sql` (below the existing index block):

```sql
CREATE INDEX IF NOT EXISTS idx_perf_company_name       ON public.performance_records (company_name);
CREATE INDEX IF NOT EXISTS idx_perf_player_country     ON public.performance_records (player_country);
CREATE INDEX IF NOT EXISTS idx_perf_problematic_source ON public.performance_records (problematic_source);
CREATE INDEX IF NOT EXISTS idx_perf_ftd_month          ON public.performance_records (ftd_month);
CREATE INDEX IF NOT EXISTS idx_perf_am                 ON public.performance_records (am);
CREATE INDEX IF NOT EXISTS idx_perf_source             ON public.performance_records (source);
CREATE INDEX IF NOT EXISTS idx_perf_period             ON public.performance_records (period);
```

- [ ] **Step 3: Apply the migration in Supabase**

Open the Supabase SQL Editor and paste the contents of `db/migrations/20260420_06_filter_parity_columns.sql`. Click Run. Expected: no errors; the `public.performance_records` Columns panel now shows `company_name`, `player_country`, `problematic_source`, `ftd_month`.

*Verification query (paste in the SQL Editor):*

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'performance_records'
ORDER BY ordinal_position;
```

Expected output must include: `company_name`, `player_country`, `problematic_source`, `ftd_month`.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/20260420_06_filter_parity_columns.sql supabase-setup.sql
git commit -m "feat(db): add company_name, player_country, problematic_source, ftd_month columns"
```

---

## Task 2: Extend `PerformanceRecord` type and `COLUMNS` list

**Files:**
- Modify: `frontend/src/utils/kpiEngine.ts:1-21`
- Modify: `frontend/src/lib/db.ts:7-12`

- [ ] **Step 1: Extend `PerformanceRecord`**

In `frontend/src/utils/kpiEngine.ts`, replace the `PerformanceRecord` interface (lines 1-21) with:

```ts
export interface PerformanceRecord {
  affiliate_id?: string;
  affiliate_name?: string;
  company_name?: string;
  country?: string;
  player_country?: string;
  campaign?: string;
  date?: string;
  ftd_month?: string;
  clicks?: number;
  registrations?: number;
  ftds?: number;
  revenue?: number;
  cost?: number;
  brand?: string;
  am?: string;
  source?: string;
  problematic_source?: number;
  period?: string | number;
  casino_real_ngr?: number;
  sb_real_ngr?: number;
  flats_and_adjustments?: number;
  [key: string]: any;
}
```

- [ ] **Step 2: Extend `COLUMNS` in db.ts**

In `frontend/src/lib/db.ts`, replace the `COLUMNS` constant (lines 7-12) with:

```ts
const COLUMNS = [
  'affiliate_id', 'affiliate_name', 'company_name',
  'country', 'player_country', 'campaign',
  'brand', 'am', 'source', 'problematic_source',
  'period', 'date', 'ftd_month',
  'clicks', 'registrations', 'ftds', 'revenue', 'cost',
  'casino_real_ngr', 'sb_real_ngr', 'flats_and_adjustments',
] as const
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run build`
Expected: `tsc -b` passes; Vite build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/kpiEngine.ts frontend/src/lib/db.ts
git commit -m "feat(types): add filter-parity fields to PerformanceRecord and db COLUMNS"
```

---

## Task 3: Extend the Excel parser for new fields

Currently `COLUMN_ALIASES` maps `company_name → affiliate_name` and `player_country → country`, collapsing separate Excel columns into one DB field. We need them preserved separately, plus a derived `ftd_month` from `FD_Date`.

**Files:**
- Modify: `frontend/src/utils/excelParser.ts:3-19`
- Create: `frontend/src/utils/__tests__/excelParser.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/utils/__tests__/excelParser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeColumnName } from '../excelParser';

describe('normalizeColumnName', () => {
  it('lowercases and underscores field names', () => {
    expect(normalizeColumnName('Partner_ID')).toBe('partner_id');
    expect(normalizeColumnName('Player_country')).toBe('player_country');
    expect(normalizeColumnName('FD_Date')).toBe('fd_date');
    expect(normalizeColumnName('Company_name')).toBe('company_name');
    expect(normalizeColumnName('problematic_source')).toBe('problematic_source');
  });
});

describe('parseExcelFile row shape', () => {
  // File-based tests live here once we have a tiny fixture; the
  // critical behaviour to cover end-to-end is that Company_name
  // does NOT collapse into affiliate_name, and Player_country
  // does NOT collapse into country.
  // For Task 3 we rely on Step 2's alias map + a direct unit
  // test against deriveFtdMonth below.
});

import { deriveFtdMonth } from '../excelParser';

describe('deriveFtdMonth', () => {
  it('returns YYYY-MM for a YYYY-MM-DD input', () => {
    expect(deriveFtdMonth('2026-03-01')).toBe('2026-03');
    expect(deriveFtdMonth('2025-12-31')).toBe('2025-12');
  });

  it('returns undefined for empty/invalid input', () => {
    expect(deriveFtdMonth(undefined)).toBeUndefined();
    expect(deriveFtdMonth('')).toBeUndefined();
    expect(deriveFtdMonth('not a date')).toBeUndefined();
  });

  it('accepts ISO timestamps and truncates to month', () => {
    expect(deriveFtdMonth('2026-03-01T00:00:00Z')).toBe('2026-03');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- excelParser`
Expected: `deriveFtdMonth` tests fail with `deriveFtdMonth is not a function` or import error.

- [ ] **Step 3: Update the parser**

Edit `frontend/src/utils/excelParser.ts`.

Replace the `COLUMN_ALIASES` block (lines 3-19) with:

```ts
// Map Excel header variants to canonical DB column names.
// Keep `company_name` and `player_country` as separate fields — the ROI
// workbook uses them as distinct pivot dimensions and collapsing them
// into affiliate_name / country loses filter granularity.
const COLUMN_ALIASES: Record<string, string> = {
  partner_id:                'affiliate_id',
  partner_name:              'affiliate_name',
  affiliate:                 'affiliate_id',
  company_name_f:            'company_name',
  campaign_name:             'campaign',
  stats_date:                'date',
  fd_date:                   'date',
  ftd_count:                 'ftds',
  ftd:                       'ftds',
  deposits_sum:              'revenue',
  partner_income:            'cost',
  flat_amt:                  'flats_and_adjustments',
  flats_and_adjustments_col: 'flats_and_adjustments',
};
```

Add — immediately after the `COLUMN_ALIASES` block — a helper that derives `ftd_month` from a date-like string:

```ts
/**
 * Extract YYYY-MM from a date-ish string. Returns undefined if the input
 * can't be parsed as a date — the Excel workbook uses "FTD month" as a
 * row grouping of FD_Date, so populating this lets us filter/group by
 * month without re-parsing dates on every render.
 */
export const deriveFtdMonth = (value: unknown): string | undefined => {
  if (value == null || value === '') return undefined;
  const str = String(value).trim();
  const match = /^(\d{4})-(\d{2})/.exec(str);
  return match ? `${match[1]}-${match[2]}` : undefined;
};
```

Then, inside `parseExcelFile`, find the `for (const row of jsonRows)` loop (around line 118) and modify the row-building block so that after the alias-normalized object is built but **before the blank-row skip**, we derive `ftd_month` and coerce `problematic_source` to a number. Replace:

```ts
for (const row of jsonRows) {
  if (isGrandTotalRow(row)) continue;

  const newRow: Record<string, any> = {};
  for (const key in row) {
    const normKey   = normalizeColumnName(key);
    const aliasedKey = COLUMN_ALIASES[normKey] ?? normKey;
    newRow[aliasedKey] = parseNumericValue(row[key]);
  }

  // Skip entirely blank rows
  if (Object.values(newRow).every(v => v == null || v === '')) continue;

  allData.push(newRow);
}
```

with:

```ts
for (const row of jsonRows) {
  if (isGrandTotalRow(row)) continue;

  const newRow: Record<string, any> = {};
  for (const key in row) {
    const normKey   = normalizeColumnName(key);
    const aliasedKey = COLUMN_ALIASES[normKey] ?? normKey;
    newRow[aliasedKey] = parseNumericValue(row[key]);
  }

  // Derive ftd_month from the canonical date column so it is available
  // as a filter/grouping dimension without re-parsing at render time.
  if (newRow.date && !newRow.ftd_month) {
    const month = deriveFtdMonth(newRow.date);
    if (month) newRow.ftd_month = month;
  }

  // problematic_source in the workbook is 0/1 — make sure it's numeric.
  if (newRow.problematic_source != null && typeof newRow.problematic_source !== 'number') {
    const n = Number(newRow.problematic_source);
    newRow.problematic_source = Number.isFinite(n) ? n : undefined;
  }

  // Skip entirely blank rows
  if (Object.values(newRow).every(v => v == null || v === '')) continue;

  allData.push(newRow);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- excelParser`
Expected: all tests pass.

- [ ] **Step 5: Manually verify the round-trip**

Run: `cd frontend && npm run dev`. Open the app at `http://localhost:5173`. Drag `local/ROI - 03.2026.xlsx` into the dropzone. Once processing completes, open DevTools → Application → IndexedDB → `roi-dashboard-db` → `records`. Open any record and confirm `company_name`, `player_country`, `ftd_month`, `problematic_source` are present (not all will have values on every sheet — that is expected). Then in Supabase, run:

```sql
SELECT company_name, player_country, ftd_month, problematic_source
FROM public.performance_records
LIMIT 10;
```

Expected: at least some rows have non-null values in the new columns.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/excelParser.ts frontend/src/utils/__tests__/excelParser.test.ts
git commit -m "feat(parser): preserve company_name, player_country; derive ftd_month"
```

---

## Task 4: Backend Filters type parity (AskAI)

**Files:**
- Modify: `api/_lib/types.ts:5-25`
- Modify: `api/_lib/tools/_filters.ts:1-10`
- Create: `api/_lib/__tests__/filters.test.ts`

- [ ] **Step 1: Write the failing test**

Create `api/_lib/__tests__/filters.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildWhereClause } from '../tools/_filters.js';

describe('buildWhereClause — new filter parity keys', () => {
  it('emits = clause for company_name', () => {
    const { whereSql, params } = buildWhereClause({ company_name: 'Clickout Media Ltd (FR + GR)' });
    expect(whereSql).toBe('WHERE company_name = $1');
    expect(params).toEqual(['Clickout Media Ltd (FR + GR)']);
  });

  it('emits ANY clause for player_country array', () => {
    const { whereSql, params } = buildWhereClause({ player_country: ['DE', 'AT'] });
    expect(whereSql).toBe('WHERE player_country = ANY($1)');
    expect(params).toEqual([['DE', 'AT']]);
  });

  it('emits = clause for problematic_source', () => {
    const { whereSql, params } = buildWhereClause({ problematic_source: '1' });
    expect(whereSql).toBe('WHERE problematic_source = $1');
    expect(params).toEqual(['1']);
  });

  it('rejects unknown filter keys', () => {
    expect(() => buildWhereClause({ bogus: 'x' } as any)).toThrow(/invalid filter/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd api && npx vitest run __tests__/filters.test.ts`
Expected: tests fail — `buildWhereClause` throws `invalid filter: company_name` because the new keys aren't allowed yet.

- [ ] **Step 3: Extend the backend types**

Edit `api/_lib/types.ts`. Replace the `Dim` and `Filters` exports (lines 5-25) with:

```ts
export type Dim =
  | 'affiliate_id' | 'affiliate_name' | 'company_name'
  | 'country'      | 'player_country' | 'campaign'
  | 'brand'        | 'am'             | 'source'
  | 'problematic_source';

export type Metric =
  | 'revenue' | 'cost' | 'profit' | 'roi' | 'ftds' | 'clicks'
  | 'registrations' | 'cpa' | 'conversion_rate'
  | 'casino_real_ngr' | 'sb_real_ngr' | 'flats_and_adjustments';

export type Filters = {
  affiliate_id?:        string | string[];
  affiliate_name?:      string | string[];
  company_name?:        string | string[];
  country?:             string | string[];
  player_country?:      string | string[];
  campaign?:            string | string[];
  brand?:               string | string[];
  am?:                  string | string[];
  source?:              string | string[];
  problematic_source?:  string | string[];
  period?:              string | string[];
  ftd_month?:           string | string[];
  date_from?:           string;   // 'YYYY-MM-DD'
  date_to?:             string;   // 'YYYY-MM-DD'
};
```

- [ ] **Step 4: Extend the allow-lists in `_filters.ts`**

Edit `api/_lib/tools/_filters.ts` lines 3-10 — replace the two `Set` declarations with:

```ts
export const ALLOWED_DIMS: Set<Dim> = new Set([
  'affiliate_id','affiliate_name','company_name',
  'country','player_country','campaign',
  'brand','am','source','problematic_source',
]);

const ALLOWED_FILTER_KEYS = new Set<keyof Filters>([
  'affiliate_id','affiliate_name','company_name',
  'country','player_country','campaign',
  'brand','am','source','problematic_source',
  'period','ftd_month','date_from','date_to',
]);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd api && npx vitest run __tests__/filters.test.ts`
Expected: all four tests pass.

Also run the full API suite to confirm no regressions: `cd api && npx vitest run`
Expected: agent.test, rateLimit.test, sseEncoder.test, filters.test all pass.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/types.ts api/_lib/tools/_filters.ts api/_lib/__tests__/filters.test.ts
git commit -m "feat(api): add company_name, player_country, problematic_source, ftd_month to Filters"
```

---

## Task 5: Build `applyFilters()` pure function

This is the engine the UI drives. Every dimension maps to an array (empty = no filter). Dates use `date_from`/`date_to` strings comparable lexicographically (works because dates are stored as ISO `YYYY-MM-DD`).

**Files:**
- Create: `frontend/src/utils/applyFilters.ts`
- Create: `frontend/src/utils/__tests__/applyFilters.test.ts`
- Modify: `frontend/src/types/filters.ts`

- [ ] **Step 1: Update the `GlobalFilters` type**

Replace the full contents of `frontend/src/types/filters.ts` with:

```ts
/**
 * One source of truth for all dashboard filters.
 * All selections are arrays: an empty array means "no filter on this dim".
 * Dates use ISO 'YYYY-MM-DD' strings; empty string means "no bound".
 */
export interface GlobalFilters {
  searchTerm: string;
  dateFrom: string;                       // '' or 'YYYY-MM-DD'
  dateTo: string;                         // '' or 'YYYY-MM-DD'
  selectedPartnerIds: string[];
  selectedBrands: string[];
  selectedCompanyNames: string[];
  selectedAMs: string[];
  selectedSources: string[];
  selectedPlayerCountries: string[];
  selectedPeriods: string[];
  selectedFtdMonths: string[];
  problematicSource: 'all' | 'yes' | 'no'; // tri-state toggle, default 'all'
}

export const EMPTY_FILTERS: GlobalFilters = {
  searchTerm: '',
  dateFrom: '',
  dateTo: '',
  selectedPartnerIds: [],
  selectedBrands: [],
  selectedCompanyNames: [],
  selectedAMs: [],
  selectedSources: [],
  selectedPlayerCountries: [],
  selectedPeriods: [],
  selectedFtdMonths: [],
  problematicSource: 'all',
};

export interface FilterOptions {
  partnerIds: string[];
  brands: string[];
  companyNames: string[];
  ams: string[];
  sources: string[];
  playerCountries: string[];
  periods: string[];
  ftdMonths: string[];
}
```

- [ ] **Step 2: Write the failing tests**

Create `frontend/src/utils/__tests__/applyFilters.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyFilters, extractFilterOptions } from '../applyFilters';
import { EMPTY_FILTERS } from '../../types/filters';
import type { PerformanceRecord } from '../kpiEngine';

const data: PerformanceRecord[] = [
  { affiliate_id: '1', brand: 'SP',  am: 'Gemma',    source: 'FP', player_country: 'DE', period: 0, date: '2026-03-01', ftd_month: '2026-03', company_name: 'Acme', problematic_source: 0, revenue: 100 },
  { affiliate_id: '2', brand: 'L7',  am: 'Charisse', source: 'L7', player_country: 'AT', period: 1, date: '2026-02-01', ftd_month: '2026-02', company_name: 'Beta', problematic_source: 1, revenue: 200 },
  { affiliate_id: '3', brand: 'LV',  am: 'Gemma',    source: 'RO', player_country: 'DE', period: 2, date: '2026-01-01', ftd_month: '2026-01', company_name: 'Acme', problematic_source: 0, revenue: 300 },
];

describe('applyFilters', () => {
  it('returns everything when filters are empty', () => {
    expect(applyFilters(data, EMPTY_FILTERS)).toHaveLength(3);
  });

  it('filters by selected brands (OR within dimension)', () => {
    const out = applyFilters(data, { ...EMPTY_FILTERS, selectedBrands: ['SP', 'LV'] });
    expect(out.map(r => r.affiliate_id)).toEqual(['1', '3']);
  });

  it('intersects across dimensions (AND between dimensions)', () => {
    const out = applyFilters(data, {
      ...EMPTY_FILTERS,
      selectedBrands:          ['SP', 'LV'],
      selectedPlayerCountries: ['DE'],
      selectedAMs:             ['Gemma'],
    });
    expect(out.map(r => r.affiliate_id)).toEqual(['1', '3']);
  });

  it('applies date_from/date_to inclusive bounds', () => {
    const out = applyFilters(data, { ...EMPTY_FILTERS, dateFrom: '2026-02-01', dateTo: '2026-03-01' });
    expect(out.map(r => r.affiliate_id)).toEqual(['1', '2']);
  });

  it('tri-state problematicSource: yes keeps only 1, no keeps only 0, all keeps both', () => {
    expect(applyFilters(data, { ...EMPTY_FILTERS, problematicSource: 'yes' })
      .map(r => r.affiliate_id)).toEqual(['2']);
    expect(applyFilters(data, { ...EMPTY_FILTERS, problematicSource: 'no' })
      .map(r => r.affiliate_id)).toEqual(['1', '3']);
    expect(applyFilters(data, { ...EMPTY_FILTERS, problematicSource: 'all' })).toHaveLength(3);
  });

  it('searchTerm matches affiliate_id, company_name, or am (case-insensitive)', () => {
    const out = applyFilters(data, { ...EMPTY_FILTERS, searchTerm: 'acme' });
    expect(out.map(r => r.affiliate_id)).toEqual(['1', '3']);
  });

  it('coerces period to string for comparison', () => {
    const out = applyFilters(data, { ...EMPTY_FILTERS, selectedPeriods: ['1', '2'] });
    expect(out.map(r => r.affiliate_id)).toEqual(['2', '3']);
  });
});

describe('extractFilterOptions', () => {
  it('returns sorted unique values per dimension', () => {
    const opts = extractFilterOptions(data);
    expect(opts.brands).toEqual(['L7', 'LV', 'SP']);
    expect(opts.ams).toEqual(['Charisse', 'Gemma']);
    expect(opts.playerCountries).toEqual(['AT', 'DE']);
    expect(opts.periods).toEqual(['0', '1', '2']);
    expect(opts.ftdMonths).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('omits null/undefined/empty values', () => {
    const opts = extractFilterOptions([
      ...data,
      { affiliate_id: '4', brand: '', am: undefined, source: null as unknown as string },
    ]);
    expect(opts.brands).toEqual(['L7', 'LV', 'SP']);
    expect(opts.ams).toEqual(['Charisse', 'Gemma']);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd frontend && npm test -- applyFilters`
Expected: fails — `applyFilters` and `extractFilterOptions` don't exist.

- [ ] **Step 4: Implement `applyFilters` and `extractFilterOptions`**

Create `frontend/src/utils/applyFilters.ts`:

```ts
import type { PerformanceRecord } from './kpiEngine';
import type { GlobalFilters, FilterOptions } from '../types/filters';

/**
 * Apply the global filter bar to an in-memory record array.
 * Pure function: same inputs → same output, no side effects.
 * Semantics:
 *   - Empty arrays / empty strings mean "no filter on this dimension".
 *   - Within a dimension, values are OR'd (selectedBrands: ['SP','LV'] = SP or LV).
 *   - Across dimensions, filters are AND'd.
 *   - Date bounds are inclusive and lexicographic on 'YYYY-MM-DD' strings.
 */
export function applyFilters(
  data: PerformanceRecord[],
  f: GlobalFilters,
): PerformanceRecord[] {
  const search = f.searchTerm.trim().toLowerCase();

  return data.filter(r => {
    if (f.selectedPartnerIds.length      && !f.selectedPartnerIds.includes(String(r.affiliate_id ?? '')))            return false;
    if (f.selectedBrands.length          && !f.selectedBrands.includes(String(r.brand ?? '')))                       return false;
    if (f.selectedCompanyNames.length    && !f.selectedCompanyNames.includes(String(r.company_name ?? '')))          return false;
    if (f.selectedAMs.length             && !f.selectedAMs.includes(String(r.am ?? '')))                             return false;
    if (f.selectedSources.length         && !f.selectedSources.includes(String(r.source ?? '')))                     return false;
    if (f.selectedPlayerCountries.length && !f.selectedPlayerCountries.includes(String(r.player_country ?? '')))     return false;
    if (f.selectedPeriods.length         && !f.selectedPeriods.includes(String(r.period ?? '')))                     return false;
    if (f.selectedFtdMonths.length       && !f.selectedFtdMonths.includes(String(r.ftd_month ?? '')))                return false;

    if (f.problematicSource === 'yes' && r.problematic_source !== 1) return false;
    if (f.problematicSource === 'no'  && r.problematic_source === 1) return false;

    if (f.dateFrom && (!r.date || r.date < f.dateFrom)) return false;
    if (f.dateTo   && (!r.date || r.date > f.dateTo))   return false;

    if (search) {
      const hay = [
        r.affiliate_id, r.affiliate_name, r.company_name, r.am, r.brand, r.source, r.campaign,
      ].map(v => String(v ?? '').toLowerCase()).join(' ');
      if (!hay.includes(search)) return false;
    }

    return true;
  });
}

/**
 * Collect the set of distinct non-empty values per filter dimension so the
 * filter bar can populate its dropdowns. Returns values sorted alphabetically.
 */
export function extractFilterOptions(data: PerformanceRecord[]): FilterOptions {
  const sets: Record<keyof FilterOptions, Set<string>> = {
    partnerIds:      new Set(),
    brands:          new Set(),
    companyNames:    new Set(),
    ams:             new Set(),
    sources:         new Set(),
    playerCountries: new Set(),
    periods:         new Set(),
    ftdMonths:       new Set(),
  };

  for (const r of data) {
    const add = (s: Set<string>, v: unknown) => {
      const str = v == null ? '' : String(v).trim();
      if (str) s.add(str);
    };
    add(sets.partnerIds,      r.affiliate_id);
    add(sets.brands,          r.brand);
    add(sets.companyNames,    r.company_name);
    add(sets.ams,             r.am);
    add(sets.sources,         r.source);
    add(sets.playerCountries, r.player_country);
    add(sets.periods,         r.period);
    add(sets.ftdMonths,       r.ftd_month);
  }

  const sortNumericFriendly = (arr: string[]) => arr.sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });

  return {
    partnerIds:      sortNumericFriendly([...sets.partnerIds]),
    brands:          [...sets.brands].sort(),
    companyNames:    [...sets.companyNames].sort(),
    ams:             [...sets.ams].sort(),
    sources:         [...sets.sources].sort(),
    playerCountries: [...sets.playerCountries].sort(),
    periods:         sortNumericFriendly([...sets.periods]),
    ftdMonths:       [...sets.ftdMonths].sort(),
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && npm test -- applyFilters`
Expected: all 9 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/applyFilters.ts frontend/src/utils/__tests__/applyFilters.test.ts frontend/src/types/filters.ts
git commit -m "feat(filters): add applyFilters and extractFilterOptions with tests"
```

---

## Task 6: `FilterContext` provider and `useFilters()` hook

**Files:**
- Create: `frontend/src/contexts/FilterContext.tsx`

- [ ] **Step 1: Implement the context**

Create `frontend/src/contexts/FilterContext.tsx`:

```tsx
import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { EMPTY_FILTERS } from '../types/filters';
import type { GlobalFilters } from '../types/filters';

interface FilterContextValue {
  filters: GlobalFilters;
  setFilters: (next: GlobalFilters) => void;
  updateFilter: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void;
  reset: () => void;
  activeCount: number;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<GlobalFilters>(EMPTY_FILTERS);

  const updateFilter = useCallback(<K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.searchTerm.trim())             n++;
    if (filters.dateFrom || filters.dateTo)    n++;
    if (filters.selectedPartnerIds.length)     n++;
    if (filters.selectedBrands.length)         n++;
    if (filters.selectedCompanyNames.length)   n++;
    if (filters.selectedAMs.length)            n++;
    if (filters.selectedSources.length)        n++;
    if (filters.selectedPlayerCountries.length) n++;
    if (filters.selectedPeriods.length)        n++;
    if (filters.selectedFtdMonths.length)      n++;
    if (filters.problematicSource !== 'all')   n++;
    return n;
  }, [filters]);

  const value = useMemo(
    () => ({ filters, setFilters, updateFilter, reset, activeCount }),
    [filters, updateFilter, reset, activeCount],
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used inside <FilterProvider>');
  return ctx;
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npm run build`
Expected: build passes.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/contexts/FilterContext.tsx
git commit -m "feat(filters): add FilterContext provider and useFilters hook"
```

---

## Task 7: FilterBar UI — dropdowns, chips, date range, reset

**Files:**
- Create: `frontend/src/components/FilterBar/FilterDropdown.tsx`
- Create: `frontend/src/components/FilterBar/ActiveFilterChips.tsx`
- Create: `frontend/src/components/FilterBar/FilterBar.tsx`
- Create: `frontend/src/components/FilterBar/FilterBar.css`

- [ ] **Step 1: Implement `FilterDropdown` (multi-select with search)**

Create `frontend/src/components/FilterBar/FilterDropdown.tsx`:

```tsx
import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Virtualization threshold — when > this many options, switch to a
   *  "top 200 matches" render to keep the DOM responsive for big lists
   *  (Excel's Company_name has ~2,277 distinct values). */
  windowSize?: number;
}

const DEFAULT_WINDOW = 200;

export function FilterDropdown({ label, options, selected, onChange, windowSize = DEFAULT_WINDOW }: Props) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState('');
  const rootRef             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? options.filter(o => o.toLowerCase().includes(q)) : options;
    return base.slice(0, windowSize);
  }, [options, query, windowSize]);

  const truncated = options.length > filtered.length + (query ? 0 : 0) && filtered.length === windowSize;

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(s => s !== value) : [...selected, value]);
  };

  const allSelected = selected.length === 0; // empty = "(All)" in Excel terms

  return (
    <div ref={rootRef} className="filter-dropdown">
      <button
        type="button"
        className={`filter-dropdown__trigger${selected.length ? ' is-active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="filter-dropdown__label">{label}</span>
        <span className="filter-dropdown__value">
          {allSelected ? '(All)' : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="filter-dropdown__panel" role="listbox">
          <div className="filter-dropdown__search">
            <Search size={12} />
            <input
              type="text"
              placeholder={`Search ${label.toLowerCase()}…`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="filter-dropdown__option filter-dropdown__option--all"
            onClick={() => onChange([])}
          >
            <input type="checkbox" checked={allSelected} readOnly />
            <span>(All)</span>
          </button>

          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              className="filter-dropdown__option"
              onClick={() => toggle(opt)}
            >
              <input type="checkbox" checked={selected.includes(opt)} readOnly />
              <span>{opt}</span>
            </button>
          ))}

          {filtered.length === 0 && <div className="filter-dropdown__empty">No matches</div>}
          {truncated && (
            <div className="filter-dropdown__truncated">
              Showing first {windowSize}. Refine the search to see more.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement `ActiveFilterChips`**

Create `frontend/src/components/FilterBar/ActiveFilterChips.tsx`:

```tsx
import { X } from 'lucide-react';
import type { GlobalFilters } from '../../types/filters';

interface Props {
  filters: GlobalFilters;
  update: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void;
}

interface Chip { label: string; onClear: () => void; }

export function ActiveFilterChips({ filters, update }: Props) {
  const chips: Chip[] = [];

  const arrayChip = <K extends keyof GlobalFilters>(
    label: string,
    key: K,
    values: string[],
  ) => {
    if (values.length === 0) return;
    chips.push({
      label: `${label}: ${values.length === 1 ? values[0] : `${values.length} selected`}`,
      onClear: () => update(key, [] as unknown as GlobalFilters[K]),
    });
  };

  arrayChip('Partner',  'selectedPartnerIds',      filters.selectedPartnerIds);
  arrayChip('Brand',    'selectedBrands',          filters.selectedBrands);
  arrayChip('Company',  'selectedCompanyNames',    filters.selectedCompanyNames);
  arrayChip('AM',       'selectedAMs',             filters.selectedAMs);
  arrayChip('Source',   'selectedSources',         filters.selectedSources);
  arrayChip('Country',  'selectedPlayerCountries', filters.selectedPlayerCountries);
  arrayChip('Period',   'selectedPeriods',         filters.selectedPeriods);
  arrayChip('Month',    'selectedFtdMonths',       filters.selectedFtdMonths);

  if (filters.dateFrom || filters.dateTo) {
    chips.push({
      label: `Date: ${filters.dateFrom || '…'} → ${filters.dateTo || '…'}`,
      onClear: () => { update('dateFrom', ''); update('dateTo', ''); },
    });
  }

  if (filters.problematicSource !== 'all') {
    chips.push({
      label: `Problematic: ${filters.problematicSource}`,
      onClear: () => update('problematicSource', 'all'),
    });
  }

  if (filters.searchTerm.trim()) {
    chips.push({
      label: `Search: "${filters.searchTerm}"`,
      onClear: () => update('searchTerm', ''),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="filter-chips">
      {chips.map((c, i) => (
        <button key={i} type="button" className="filter-chip" onClick={c.onClear}>
          <span>{c.label}</span>
          <X size={11} />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Implement `FilterBar`**

Create `frontend/src/components/FilterBar/FilterBar.tsx`:

```tsx
import { useMemo } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { useFilters } from '../../contexts/FilterContext';
import { extractFilterOptions } from '../../utils/applyFilters';
import { FilterDropdown } from './FilterDropdown';
import { ActiveFilterChips } from './ActiveFilterChips';
import type { PerformanceRecord } from '../../utils/kpiEngine';
import './FilterBar.css';

interface Props { data: PerformanceRecord[]; }

export function FilterBar({ data }: Props) {
  const { filters, updateFilter, reset, activeCount } = useFilters();
  const options = useMemo(() => extractFilterOptions(data), [data]);

  return (
    <div className="filter-bar">
      <div className="filter-bar__row">
        <div className="filter-bar__search">
          <Search size={13} />
          <input
            type="text"
            placeholder="Search partner, company, AM, brand, source…"
            value={filters.searchTerm}
            onChange={e => updateFilter('searchTerm', e.target.value)}
          />
        </div>

        <FilterDropdown label="Partner"  options={options.partnerIds}      selected={filters.selectedPartnerIds}      onChange={v => updateFilter('selectedPartnerIds',      v)} />
        <FilterDropdown label="Brand"    options={options.brands}          selected={filters.selectedBrands}          onChange={v => updateFilter('selectedBrands',          v)} />
        <FilterDropdown label="Company"  options={options.companyNames}    selected={filters.selectedCompanyNames}    onChange={v => updateFilter('selectedCompanyNames',    v)} />
        <FilterDropdown label="AM"       options={options.ams}             selected={filters.selectedAMs}             onChange={v => updateFilter('selectedAMs',             v)} />
        <FilterDropdown label="Source"   options={options.sources}         selected={filters.selectedSources}         onChange={v => updateFilter('selectedSources',         v)} />
        <FilterDropdown label="Country"  options={options.playerCountries} selected={filters.selectedPlayerCountries} onChange={v => updateFilter('selectedPlayerCountries', v)} />
        <FilterDropdown label="Period"   options={options.periods}         selected={filters.selectedPeriods}         onChange={v => updateFilter('selectedPeriods',         v)} />
        <FilterDropdown label="Month"    options={options.ftdMonths}       selected={filters.selectedFtdMonths}       onChange={v => updateFilter('selectedFtdMonths',       v)} />

        <div className="filter-bar__date-range">
          <label>
            From
            <input type="date" value={filters.dateFrom} onChange={e => updateFilter('dateFrom', e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={filters.dateTo} onChange={e => updateFilter('dateTo', e.target.value)} />
          </label>
        </div>

        <label className="filter-bar__problematic">
          Problematic
          <select
            value={filters.problematicSource}
            onChange={e => updateFilter('problematicSource', e.target.value as 'all' | 'yes' | 'no')}
          >
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>

        <button
          type="button"
          className="filter-bar__reset"
          onClick={reset}
          disabled={activeCount === 0}
          aria-label="Reset filters"
        >
          <RotateCcw size={12} />
          Reset{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>

      <ActiveFilterChips filters={filters} update={updateFilter} />
    </div>
  );
}
```

- [ ] **Step 4: Add styles**

Create `frontend/src/components/FilterBar/FilterBar.css`:

```css
.filter-bar {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 16px;
  font-family: var(--font-body);
}

.filter-bar__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.filter-bar__search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-input, rgba(255,255,255,0.03));
  min-width: 220px;
  flex: 1 1 220px;
}
.filter-bar__search input {
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.8rem;
  flex: 1;
  outline: none;
}

.filter-bar__date-range {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 0.75rem;
  color: var(--text-secondary);
}
.filter-bar__date-range input {
  margin-left: 4px;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.75rem;
}

.filter-bar__problematic {
  font-size: 0.75rem;
  color: var(--text-secondary);
  display: flex;
  gap: 4px;
  align-items: center;
}
.filter-bar__problematic select {
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.75rem;
}

.filter-bar__reset {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.75rem;
  cursor: pointer;
}
.filter-bar__reset:disabled { opacity: 0.4; cursor: not-allowed; }

.filter-dropdown { position: relative; }
.filter-dropdown__trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.75rem;
  cursor: pointer;
  min-width: 120px;
}
.filter-dropdown__trigger.is-active { border-color: #00d4ff; }
.filter-dropdown__label   { color: var(--text-secondary); }
.filter-dropdown__value   { flex: 1; text-align: left; font-weight: 500; }

.filter-dropdown__panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 60;
  min-width: 240px;
  max-height: 360px;
  overflow-y: auto;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  padding: 6px;
}
.filter-dropdown__search {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}
.filter-dropdown__search input {
  border: none; background: transparent; color: var(--text-primary);
  font-size: 0.75rem; flex: 1; outline: none;
}
.filter-dropdown__option {
  display: flex; align-items: center; gap: 6px;
  width: 100%; padding: 5px 8px;
  border: none; background: transparent;
  color: var(--text-primary); font-size: 0.75rem; text-align: left; cursor: pointer;
  border-radius: 4px;
}
.filter-dropdown__option:hover { background: rgba(255,255,255,0.04); }
.filter-dropdown__option--all  { border-bottom: 1px dashed var(--border); margin-bottom: 2px; }
.filter-dropdown__empty,
.filter-dropdown__truncated { padding: 6px 8px; font-size: 0.72rem; color: var(--text-secondary); }

.filter-chips {
  display: flex; flex-wrap: wrap; gap: 4px;
  margin-top: 8px;
}
.filter-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: rgba(0, 212, 255, 0.08);
  color: var(--text-primary);
  font-size: 0.7rem;
  cursor: pointer;
}
.filter-chip:hover { background: rgba(239, 68, 68, 0.12); }
```

- [ ] **Step 5: Type-check**

Run: `cd frontend && npm run build`
Expected: build passes; no unused imports.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/FilterBar
git commit -m "feat(filters): add FilterBar, FilterDropdown, ActiveFilterChips UI"
```

---

## Task 8: Integrate the filter bar into `App.tsx`

Pages already accept `data: PerformanceRecord[]`. We wrap the app in `FilterProvider`, render `FilterBar` above the content, and pass `filteredData` down.

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Wire the provider and filtered-data flow**

Edit `frontend/src/App.tsx`. Add these imports near the top (after line 13):

```ts
import { FilterProvider } from './contexts/FilterContext';
import { FilterBar } from './components/FilterBar/FilterBar';
import { useFilters } from './contexts/FilterContext';
import { applyFilters } from './utils/applyFilters';
import { useMemo } from 'react';
```

Below the existing `function App()` declaration, factor the inner content into a child component so it can call `useFilters()` (hooks require being inside the provider). Replace the entire `App` component (lines 88-297) with:

```tsx
function App() {
  return (
    <FilterProvider>
      <AppShell />
    </FilterProvider>
  );
}

function AppShell() {
  const [data, setData]               = useState<PerformanceRecord[]>([]);
  const [deletedData, setDeletedData] = useState<PerformanceRecord[]>([]);
  const [deletedAt, setDeletedAt]     = useState<Date | null>(null);
  const [activeTab, setActiveTab]     = useState('Overview');
  const [loading, setLoading]         = useState(true);
  const [isDraggingOver, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { filters } = useFilters();
  const filteredData = useMemo(() => applyFilters(data, filters), [data, filters]);

  useEffect(() => {
    navigator.storage?.persist?.().catch(() => { /* not supported in all browsers */ });
    (async () => {
      try {
        const remote = await fetchRecords();
        setData(remote);
        saveToIDB(remote).catch(e => console.warn('IDB cache save failed:', e));
      } catch (err) {
        console.warn('Supabase fetch failed — falling back to local cache:', err);
        try {
          const local = await loadFromIDB();
          if (local.length > 0) setData(local);
        } catch (idbErr) {
          console.error('Both Supabase and IDB failed:', idbErr);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    let parsedData: PerformanceRecord[];
    try {
      parsedData = await parseExcelFile(file);
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Failed to read file. Make sure it is a valid Excel or CSV file.');
      setLoading(false);
      return;
    }
    try {
      await replaceRecords(parsedData);
    } catch (err) {
      console.error('Supabase sync failed:', err);
      alert(
        'Failed to save data to the cloud. Check your internet connection and try again.\n\n' +
        'Your existing data has not been modified.'
      );
      setLoading(false);
      return;
    }
    setData(parsedData);
    try {
      await saveToIDB(parsedData);
    } catch (idbError) {
      console.warn('IDB cache save failed (data is safely in the cloud):', idbError);
    }
    setLoading(false);
  };

  const handleClearData = async () => {
    try {
      await clearRecords();
    } catch (err) {
      console.error('Supabase clear failed:', err);
      alert('Failed to clear cloud data. Check your internet connection and try again.');
      return;
    }
    setDeletedData(data);
    setDeletedAt(new Date());
    setData([]);
    setActiveTab('Deleted');
    clearIDB().catch(e => console.warn('IDB cache clear failed:', e));
  };

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      alert('Please drop an Excel file (.xlsx, .xls, or .csv)');
      return;
    }
    handleFileUpload(file);
  };

  const switchTab = (tab: string) => { setActiveTab(tab); setSidebarOpen(false); };

  return (
    <div className="app-root">
      <header className="mobile-header">
        <div className="mobile-header__logo">
          <BarChart3 size={18} className="mobile-header__logo-icon" />
          <span>ROI Dashboard</span>
        </div>
        <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
      </header>

      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        onFileUpload={handleFileUpload}
        onClearData={handleClearData}
        activeTab={activeTab}
        setActiveTab={switchTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        recordCount={filteredData.length}
        deletedCount={deletedData.length}
      />

      <main
        className="main-content"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDraggingOver && (
          <div className="drop-overlay">
            <div className="drop-overlay__inner">
              <p>Drop your Excel file here</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <div className="spinner" />
            <p>Processing dataset…</p>
          </div>
        )}

        {!loading && activeTab === 'AskAI' && (
          <div className="fade-in"><AskAI /></div>
        )}

        {!loading && data.length === 0 && activeTab !== 'Deleted' && activeTab !== 'AskAI' && (
          <div className="empty-state">
            <div className="empty-state__icon">
              <BarChart3 size={34} />
            </div>
            <h2>Ready to analyze</h2>
            <p>
              Upload your affiliate performance data via the sidebar to generate
              instant KPI dashboards and insights.
            </p>
          </div>
        )}

        {!loading && activeTab === 'Deleted' && (
          <div className="fade-in">
            <Deleted data={deletedData} clearedAt={deletedAt} />
          </div>
        )}

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
      </main>

      <nav className="mobile-bottom-nav">
        {TABS.filter(({ id }) => id !== 'Deleted' || deletedData.length > 0).map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`mobile-bottom-nav__item${activeTab === id ? ' active' : ''}`}
            onClick={() => switchTab(id)}
          >
            <Icon size={18} />
            <span className="mobile-bottom-nav__label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
```

Note: `FilterBar` is given the unfiltered `data` so its dropdowns always show the full option set; pages receive `filteredData`. The sidebar's `recordCount` now reflects the filtered count so users see what they've narrowed to.

- [ ] **Step 2: Type-check and test**

Run: `cd frontend && npm run build`
Expected: build passes.

Run: `cd frontend && npm test`
Expected: all suites pass (existing + new `applyFilters` + `excelParser`).

- [ ] **Step 3: Manual end-to-end verification**

Run: `cd frontend && npm run dev`. Open `http://localhost:5173`.

1. Upload `local/ROI - 03.2026.xlsx`.
2. Confirm the FilterBar appears above the Overview content once data loads.
3. Open the **Brand** dropdown — expect options like `SP, LV, L7, RS, RB, RO, PM, SU, SJ, FP, DU` (drawn from the workbook's 15 Brand values).
4. Select one brand — expect KPI cards and charts on Overview to refresh immediately with the narrowed data.
5. Switch to **Affiliates** — expect the same filter to still apply (chip visible above content).
6. Add a **Date** range — expect both Overview and Affiliates to narrow further.
7. Click a chip's × — expect that filter alone to clear; other chips remain.
8. Click **Reset** — expect all chips to disappear and full data to reappear.
9. Flip the **Problematic** dropdown to `Yes` — expect a dramatically smaller dataset (only rows where `problematic_source = 1`).
10. Type `gemma` in the search box — expect only rows where any of affiliate_id / company_name / am / brand / source / campaign contains "gemma".

If any step fails, STOP and report which step + what you saw. Do not claim completion.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(filters): mount FilterProvider, FilterBar, and apply filters across pages"
```

---

## Self-Review Notes

1. **Spec coverage:**
   - Schema (3 new columns + ftd_month) — Task 1 ✓
   - Types synced end-to-end — Tasks 2, 4 ✓
   - Excel parser preserves separate fields + derives ftd_month — Task 3 ✓
   - applyFilters engine — Task 5 ✓
   - FilterContext state — Task 6 ✓
   - FilterBar UI with 8 dimension dropdowns + date range + problematic tri-state + reset + chips — Task 7 ✓
   - Integration across all pages — Task 8 ✓
   - No pivot views, no affiliate profile, no cohort — correctly deferred to Plans 2–4 ✓

2. **Placeholder scan:** none — every step has concrete code or concrete commands with expected output.

3. **Type consistency:**
   - `GlobalFilters` shape declared in Task 5 Step 1 is used verbatim in Tasks 6, 7, 8.
   - `FilterOptions` shape declared in Task 5 Step 1 matches the return of `extractFilterOptions()` in Step 4 and the consumer in Task 7.
   - Backend `Filters` keys in Task 4 Step 3 match the new columns in Task 1 Step 1.
   - Frontend `PerformanceRecord` (Task 2) and `COLUMNS` (Task 2) and backend `Filters` (Task 4) all reference the same 4 new field names: `company_name`, `player_country`, `problematic_source`, `ftd_month`.
