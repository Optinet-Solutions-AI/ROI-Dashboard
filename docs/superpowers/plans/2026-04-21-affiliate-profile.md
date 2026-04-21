# Affiliate Profile — Implementation Plan (Plan 3 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-affiliate profile that opens when a user clicks a partner row in the `Affiliates` page. The profile shows a header strip (Partner_ID, primary Company name, AM, brand mix, country mix, first/last FTD date), the full KPI strip from Overview scoped to the partner, a time-series chart, brand and country sub-tables, and a recent-rows table — all respecting the global filter bar.

**Architecture:**
- Extend the existing tab model with a virtual `'AffiliateProfile'` tab and a `selectedPartnerId` state in `AppShell`. No routing library — consistent with the existing tab-based navigation.
- Clicking a partner row in the `Affiliates` page sets `selectedPartnerId` and switches the tab.
- The profile receives `filteredData` from `AppShell` and scopes further to `affiliate_id === selectedPartnerId`. Clean layering — the profile owns its scope; the filter bar state is untouched.
- `affiliateMeta(records)` is a pure function that derives header fields from the scoped records: primary `company_name`, `am`, brand-mix with counts, country-mix with counts, first and last `date`.
- **Plan 1 follow-up #3** (empty-state retrofit) folded in as the final task: `NoMatchingRows` gets used on Overview / Affiliates / Campaigns / Insights / Data when the filter bar narrows `filteredData.length` to zero.

**Tech Stack:** React 19, TypeScript 6, Vite 8, vitest 4, recharts, lucide-react. No new dependencies.

**Scope boundary — what this plan does NOT do:**
- No URL deep-linking / hash routing — the profile survives only in-session (noted as a polish follow-up).
- No `ByPartner` pivot page — the ROI workbook doesn't have one as a distinct sheet; the profile itself plus the existing `Affiliates` page cover the partner-level view.
- No edits to the `AskAI` backend `Filters` type — the profile is UI-only; AskAI already supports `affiliate_id`.
- No Period cohort / computed-measure surfacing (Plan 4).

**Plan 1 follow-ups addressed in this plan:**
- **Follow-up 3** (empty-state retrofit) — Task 6 closes it for the 5 existing pages.

---

## File Structure

**New files:**
- `frontend/src/utils/affiliateMeta.ts` — pure function: `(records) → { id, name, am, brandMix, countryMix, firstDate, lastDate }`
- `frontend/src/utils/__tests__/affiliateMeta.test.ts`
- `frontend/src/components/AffiliateHeader.tsx` — top strip: big Partner ID, company name, AM, brand/country pills, date range
- `frontend/src/components/AffiliateHeader.css` — scoped styles
- `frontend/src/pages/AffiliateProfile.tsx` — composes header + KPIs + time series + brand/country mini-pivots + recent rows

**Modified files:**
- `frontend/src/pages/Affiliates.tsx` — wire the `affiliate_id` column to call `onPartnerClick(id)`, accept that prop
- `frontend/src/App.tsx` — add `selectedPartnerId` state + `'AffiliateProfile'` tab branch + back handler; pass `onPartnerClick` to `Affiliates`
- `frontend/src/pages/Overview.tsx` — render `NoMatchingRows` when `filteredData.length === 0 && activeCount > 0`
- `frontend/src/pages/Campaigns.tsx` — same
- `frontend/src/pages/Insights.tsx` — same
- `frontend/src/pages/Data.tsx` — same
- `frontend/src/pages/Affiliates.tsx` — same (bundled with the drill-through change)

---

## Task 1: `affiliateMeta` pure function (TDD)

**Files:**
- Create: `frontend/src/utils/affiliateMeta.ts`
- Create: `frontend/src/utils/__tests__/affiliateMeta.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/utils/__tests__/affiliateMeta.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { affiliateMeta } from '../affiliateMeta';
import type { PerformanceRecord } from '../kpiEngine';

const rows: PerformanceRecord[] = [
  { affiliate_id: '173343', affiliate_name: 'Acme Aff', company_name: 'Acme Ltd', am: 'Gemma',    brand: 'SP', player_country: 'DE', date: '2026-03-01', ftds: 5, revenue: 100 },
  { affiliate_id: '173343', affiliate_name: 'Acme Aff', company_name: 'Acme Ltd', am: 'Gemma',    brand: 'LV', player_country: 'AT', date: '2026-02-01', ftds: 3, revenue: 50  },
  { affiliate_id: '173343', affiliate_name: 'Acme Aff', company_name: 'Acme Ltd', am: 'Charisse', brand: 'SP', player_country: 'DE', date: '2025-11-01', ftds: 4, revenue: 80  },
];

describe('affiliateMeta', () => {
  it('extracts id, name, most-frequent AM, and ordered date range', () => {
    const meta = affiliateMeta(rows);
    expect(meta.id).toBe('173343');
    expect(meta.name).toBe('Acme Aff');
    expect(meta.companyName).toBe('Acme Ltd');
    expect(meta.am).toBe('Gemma'); // 2 rows vs Charisse 1 row
    expect(meta.firstDate).toBe('2025-11-01');
    expect(meta.lastDate).toBe('2026-03-01');
  });

  it('brandMix lists brands with counts, sorted desc by count', () => {
    const meta = affiliateMeta(rows);
    expect(meta.brandMix).toEqual([
      { key: 'SP', count: 2 },
      { key: 'LV', count: 1 },
    ]);
  });

  it('countryMix lists player_countries with counts, sorted desc by count', () => {
    const meta = affiliateMeta(rows);
    expect(meta.countryMix).toEqual([
      { key: 'DE', count: 2 },
      { key: 'AT', count: 1 },
    ]);
  });

  it('returns a null-like shape for an empty record set', () => {
    const meta = affiliateMeta([]);
    expect(meta.id).toBe('');
    expect(meta.name).toBe('');
    expect(meta.companyName).toBe('');
    expect(meta.am).toBe('');
    expect(meta.brandMix).toEqual([]);
    expect(meta.countryMix).toEqual([]);
    expect(meta.firstDate).toBe('');
    expect(meta.lastDate).toBe('');
  });

  it('skips blank brand / country / am / company values when deriving meta', () => {
    const meta = affiliateMeta([
      { affiliate_id: '1', affiliate_name: 'X', company_name: '', am: '',         brand: '',   player_country: undefined, date: '2026-01-01' },
      { affiliate_id: '1', affiliate_name: 'X', company_name: 'X Co', am: 'Andrei', brand: 'SP', player_country: 'FR',      date: '2026-02-01' },
    ]);
    expect(meta.companyName).toBe('X Co');
    expect(meta.am).toBe('Andrei');
    expect(meta.brandMix).toEqual([{ key: 'SP', count: 1 }]);
    expect(meta.countryMix).toEqual([{ key: 'FR', count: 1 }]);
  });

  it('uses String() coercion for affiliate_id so numeric IDs round-trip safely', () => {
    const meta = affiliateMeta([
      { affiliate_id: 12345 as unknown as string, affiliate_name: 'N', date: '2026-01-01' },
    ]);
    expect(meta.id).toBe('12345');
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- affiliateMeta` (CWD is `frontend/`)
Expected: all 6 tests fail with "Failed to resolve import '../affiliateMeta'".

- [ ] **Step 3: Implement**

Create `frontend/src/utils/affiliateMeta.ts`:

```ts
import type { PerformanceRecord } from './kpiEngine';

export interface Tally { key: string; count: number; }

export interface AffiliateMeta {
  id:           string;
  name:         string;
  companyName:  string;
  am:           string;
  brandMix:     Tally[];
  countryMix:   Tally[];
  firstDate:    string;
  lastDate:     string;
}

const EMPTY: AffiliateMeta = {
  id: '', name: '', companyName: '', am: '',
  brandMix: [], countryMix: [], firstDate: '', lastDate: '',
};

function tally(values: Iterable<string>): Tally[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const k = String(v ?? '').trim();
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function mostFrequent(values: Iterable<string>): string {
  const [top] = tally(values);
  return top ? top.key : '';
}

/**
 * Derive header-strip fields for the selected partner from its scoped records.
 * Pure function — no side effects. `records` should already be filtered to a
 * single affiliate_id (the profile page enforces this before calling).
 */
export function affiliateMeta(records: PerformanceRecord[]): AffiliateMeta {
  if (records.length === 0) return EMPTY;

  const id   = String(records[0].affiliate_id ?? '');
  const name = String(records[0].affiliate_name ?? '');

  const companyName = mostFrequent(records.map(r => r.company_name ?? ''));
  const am          = mostFrequent(records.map(r => r.am ?? ''));

  const brandMix    = tally(records.map(r => r.brand ?? ''));
  const countryMix  = tally(records.map(r => r.player_country ?? ''));

  const dates = records
    .map(r => String(r.date ?? '').trim())
    .filter(Boolean)
    .sort();
  const firstDate = dates[0] ?? '';
  const lastDate  = dates[dates.length - 1] ?? '';

  return { id, name, companyName, am, brandMix, countryMix, firstDate, lastDate };
}
```

- [ ] **Step 4: Tests pass**

Run: `npm test -- affiliateMeta`
Expected: all 6 tests pass.

Run full suite: `npm test`
Expected: 33 passing + 6 new = 39 passing, 0 todos.

Run build: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit on `dev`**

```bash
git add src/utils/affiliateMeta.ts src/utils/__tests__/affiliateMeta.test.ts
git commit -m "feat(affiliate): add affiliateMeta pure function with TDD"
```

---

## Task 2: `AffiliateHeader` component

**Files:**
- Create: `frontend/src/components/AffiliateHeader.tsx`
- Create: `frontend/src/components/AffiliateHeader.css`

- [ ] **Step 1: Implement component**

Create `frontend/src/components/AffiliateHeader.tsx`:

```tsx
import { ArrowLeft, Calendar, User, Briefcase } from 'lucide-react';
import type { AffiliateMeta } from '../utils/affiliateMeta';
import './AffiliateHeader.css';

interface Props {
  meta: AffiliateMeta;
  onBack: () => void;
}

export function AffiliateHeader({ meta, onBack }: Props) {
  return (
    <div className="affiliate-header">
      <button type="button" className="affiliate-header__back" onClick={onBack}>
        <ArrowLeft size={14} />
        Back
      </button>

      <div className="affiliate-header__top">
        <div className="affiliate-header__identity">
          <div className="affiliate-header__label">Partner ID</div>
          <div className="affiliate-header__id">{meta.id || '—'}</div>
          {meta.name && <div className="affiliate-header__name">{meta.name}</div>}
        </div>

        <div className="affiliate-header__facts">
          {meta.companyName && (
            <div className="affiliate-header__fact">
              <Briefcase size={12} />
              <span className="affiliate-header__fact-label">Company</span>
              <span className="affiliate-header__fact-value">{meta.companyName}</span>
            </div>
          )}
          {meta.am && (
            <div className="affiliate-header__fact">
              <User size={12} />
              <span className="affiliate-header__fact-label">AM</span>
              <span className="affiliate-header__fact-value">{meta.am}</span>
            </div>
          )}
          {(meta.firstDate || meta.lastDate) && (
            <div className="affiliate-header__fact">
              <Calendar size={12} />
              <span className="affiliate-header__fact-label">Active</span>
              <span className="affiliate-header__fact-value">
                {meta.firstDate || '…'} → {meta.lastDate || '…'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="affiliate-header__mix">
        {meta.brandMix.length > 0 && (
          <div className="affiliate-header__pills-group">
            <span className="affiliate-header__pills-label">Brands</span>
            {meta.brandMix.map(b => (
              <span key={b.key} className="affiliate-header__pill">
                {b.key} <span className="affiliate-header__pill-count">{b.count}</span>
              </span>
            ))}
          </div>
        )}
        {meta.countryMix.length > 0 && (
          <div className="affiliate-header__pills-group">
            <span className="affiliate-header__pills-label">Countries</span>
            {meta.countryMix.map(c => (
              <span key={c.key} className="affiliate-header__pill affiliate-header__pill--alt">
                {c.key} <span className="affiliate-header__pill-count">{c.count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add styles**

Create `frontend/src/components/AffiliateHeader.css`:

```css
.affiliate-header {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 18px;
  margin-bottom: 16px;
  font-family: var(--font-body);
}

.affiliate-header__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.72rem;
  cursor: pointer;
  margin-bottom: 12px;
}
.affiliate-header__back:hover { background: rgba(0, 212, 255, 0.08); }

.affiliate-header__top {
  display: flex;
  gap: 24px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.affiliate-header__identity {
  flex: 0 1 220px;
}
.affiliate-header__label {
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.affiliate-header__id {
  font-size: 1.9rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.1;
  margin-top: 2px;
}
.affiliate-header__name {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 2px;
}

.affiliate-header__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  flex: 1 1 auto;
  padding-bottom: 4px;
}
.affiliate-header__fact {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78rem;
  color: var(--text-primary);
}
.affiliate-header__fact-label {
  color: var(--text-secondary);
  margin-right: 2px;
}
.affiliate-header__fact-value { font-weight: 500; }

.affiliate-header__mix {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.affiliate-header__pills-group {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.affiliate-header__pills-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-right: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.affiliate-header__pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border-radius: 999px;
  background: rgba(0, 212, 255, 0.10);
  color: var(--text-primary);
  font-size: 0.72rem;
}
.affiliate-header__pill--alt {
  background: rgba(129, 140, 248, 0.12);
}
.affiliate-header__pill-count {
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: clean. The component is not yet used anywhere — Vite/TS will only complain if there's a syntax or import resolution issue.

- [ ] **Step 4: Commit**

```bash
git add src/components/AffiliateHeader.tsx src/components/AffiliateHeader.css
git commit -m "feat(affiliate): add AffiliateHeader component with identity + mix pills"
```

---

## Task 3: `AffiliateProfile` page composition

**Files:**
- Create: `frontend/src/pages/AffiliateProfile.tsx`

- [ ] **Step 1: Implement page**

Create `frontend/src/pages/AffiliateProfile.tsx`:

```tsx
import React, { useMemo } from 'react';
import { Euro, CreditCard, TrendingUp, Percent, UserCheck, Target, Activity, Sliders, Gift, ArrowDownCircle, Users, BarChart2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { KPICard } from '../components/KPICard';
import { AffiliateHeader } from '../components/AffiliateHeader';
import { NoMatchingRows } from '../components/NoMatchingRows';
import { PivotTable } from '../components/PivotView/PivotTable';
import { processKPIs, type PerformanceRecord } from '../utils/kpiEngine';
import { affiliateMeta } from '../utils/affiliateMeta';
import { pivotAggregate } from '../utils/pivotAggregate';
import { useChartColors } from '../lib/theme';

interface Props {
  partnerId: string;
  data: PerformanceRecord[];            // already filtered by the global FilterBar
  onBack: () => void;
}

const formatEur = (v: number) =>
  `€${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v)}`;

const pct = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

export const AffiliateProfile: React.FC<Props> = ({ partnerId, data, onBack }) => {
  const { axisColor, axisStroke, tooltipStyle } = useChartColors();

  const scoped = useMemo(
    () => data.filter(r => String(r.affiliate_id ?? '') === partnerId),
    [data, partnerId],
  );

  const meta = useMemo(() => affiliateMeta(scoped), [scoped]);
  const kpis = useMemo(() => processKPIs(scoped), [scoped]);

  const byMonth   = useMemo(() => pivotAggregate(scoped, 'ftd_month'),      [scoped]);
  const byBrand   = useMemo(() => pivotAggregate(scoped, 'brand'),          [scoped]);
  const byCountry = useMemo(() => pivotAggregate(scoped, 'player_country'), [scoped]);

  const timeData = useMemo(() => byMonth.map(r => ({
    date:    r.key,
    revenue: r.kpis.revenue,
    cost:    r.kpis.cost,
    profit:  r.kpis.profit,
  })), [byMonth]);

  if (scoped.length === 0) {
    return (
      <div>
        <AffiliateHeader meta={{ ...meta, id: partnerId }} onBack={onBack} />
        <NoMatchingRows entity="rows for this partner" />
      </div>
    );
  }

  return (
    <div>
      <AffiliateHeader meta={meta} onBack={onBack} />

      <div className="kpi-group-label">Financial</div>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KPICard label="FTD"            value={kpis.ftds.toLocaleString()}            color="#ec4899" icon={<UserCheck     size={15} />} />
        <KPICard label="Deposits Sum"   value={formatEur(kpis.revenue)}              color="#00d4ff" icon={<Euro          size={15} />} />
        <KPICard label="Casino NGR"     value={formatEur(kpis.casino_real_ngr)}      color="#10b981" icon={<TrendingUp    size={15} />} />
        <KPICard label="SB NGR"         value={formatEur(kpis.sb_real_ngr)}          color="#34d399" icon={<Activity      size={15} />} />
        <KPICard label="Partner Income" value={formatEur(kpis.cost)}                 color="#f0b429" icon={<CreditCard    size={15} />} />
        <KPICard label="Flats & Adj."   value={formatEur(kpis.flats_and_adjustments)} color="#818cf8" icon={<Sliders     size={15} />} />
      </div>

      <div className="kpi-group-label">Performance</div>
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KPICard label="ROI"       value={kpis.roi.toFixed(2)}           color="#818cf8" icon={<Percent         size={15} />} />
        <KPICard label="% Bonus"   value={pct.format(kpis.bonus_pct)}    color="#f97316" icon={<Gift            size={15} />} />
        <KPICard label="% Cashout" value={pct.format(kpis.cashout_pct)}  color="#ef4444" icon={<ArrowDownCircle size={15} />} />
        <KPICard label="ADPU"      value={formatEur(kpis.adpu)}         color="#00d4ff" icon={<Users           size={15} />} />
        <KPICard label="ARPU"      value={formatEur(kpis.arpu)}         color="#10b981" icon={<BarChart2       size={15} />} />
        <KPICard label="ECPA"      value={formatEur(kpis.ecpa)}         color="#f97316" icon={<Target          size={15} />} />
      </div>

      {timeData.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <div className="chart-title">Performance Over Time</div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gAffRev"    x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gAffCost"   x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f0b429" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#f0b429" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gAffProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="date"  stroke={axisStroke} tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis                 stroke={axisStroke} tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="revenue" stroke="#00d4ff" strokeWidth={1.5} fillOpacity={1} fill="url(#gAffRev)"    />
              <Area type="monotone" dataKey="cost"    stroke="#f0b429" strokeWidth={1.5} fillOpacity={1} fill="url(#gAffCost)"   />
              <Area type="monotone" dataKey="profit"  stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#gAffProfit)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {byBrand.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
          <div className="chart-title" style={{ padding: '12px 14px 0' }}>By Brand</div>
          <PivotTable rowLabel="Brand" rows={byBrand} data={scoped} />
        </div>
      )}

      {byCountry.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
          <div className="chart-title" style={{ padding: '12px 14px 0' }}>By Country</div>
          <PivotTable rowLabel="Country" rows={byCountry} data={scoped} />
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Build passes**

Run: `npm run build`
Expected: clean. The page is not yet reachable — Task 4 wires it in.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AffiliateProfile.tsx
git commit -m "feat(affiliate): add AffiliateProfile page composition"
```

---

## Task 4: Wire the profile into `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add imports, state, and routing**

Open `frontend/src/App.tsx`. Read it first to get oriented.

**4a.** Extend page imports (find the existing block at the top):

Add after the existing `import { Overview } from './pages/Overview';` and siblings:

```ts
import { AffiliateProfile } from './pages/AffiliateProfile';
```

**4b.** In `AppShell`, add a state hook right after the existing state hooks (around where `sidebarOpen` is declared):

```ts
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
```

**4c.** Add two handlers just above the existing `const switchTab = ...` line:

```ts
  const openAffiliateProfile = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    setActiveTab('AffiliateProfile');
    setSidebarOpen(false);
  };

  const closeAffiliateProfile = () => {
    setSelectedPartnerId(null);
    setActiveTab('Affiliates');
  };
```

**4d.** In the render branch (inside `!loading && data.length > 0 && activeTab !== 'Deleted' && activeTab !== 'AskAI'`), find the existing page switch added in Plan 2 Task 8:

```tsx
            {activeTab === 'Overview'   && <Overview   data={filteredData} />}
            {activeTab === 'ByMonth'    && <ByMonth    data={filteredData} />}
            {activeTab === 'ByCountry'  && <ByCountry  data={filteredData} />}
            {activeTab === 'ByBrand'    && <ByBrand    data={filteredData} />}
            {activeTab === 'BySource'   && <BySource   data={filteredData} />}
            {activeTab === 'Affiliates' && <Affiliates data={filteredData} />}
            {activeTab === 'Campaigns'  && <Campaigns  data={filteredData} />}
            {activeTab === 'Insights'   && <Insights   data={filteredData} />}
            {activeTab === 'Data'       && <Data       data={filteredData} />}
```

Update the `Affiliates` line to pass the open-profile handler, and add a new line for `AffiliateProfile`:

```tsx
            {activeTab === 'Overview'   && <Overview   data={filteredData} />}
            {activeTab === 'ByMonth'    && <ByMonth    data={filteredData} />}
            {activeTab === 'ByCountry'  && <ByCountry  data={filteredData} />}
            {activeTab === 'ByBrand'    && <ByBrand    data={filteredData} />}
            {activeTab === 'BySource'   && <BySource   data={filteredData} />}
            {activeTab === 'Affiliates' && <Affiliates data={filteredData} onPartnerClick={openAffiliateProfile} />}
            {activeTab === 'Campaigns'  && <Campaigns  data={filteredData} />}
            {activeTab === 'Insights'   && <Insights   data={filteredData} />}
            {activeTab === 'Data'       && <Data       data={filteredData} />}
            {activeTab === 'AffiliateProfile' && selectedPartnerId && (
              <AffiliateProfile partnerId={selectedPartnerId} data={filteredData} onBack={closeAffiliateProfile} />
            )}
```

**4e.** Do NOT add `'AffiliateProfile'` to the sidebar `TABS` constant — it's a virtual tab reachable only via drill-through.

- [ ] **Step 2: Build passes (will fail until Task 5 adds the `onPartnerClick` prop to Affiliates)**

Run: `npm run build`
Expected: TypeScript error on the `Affiliates onPartnerClick={...}` line because `Affiliates`'s `Props` doesn't yet accept that prop. This is expected. Proceed to Task 5 immediately; don't commit yet.

If the error is different or the build unexpectedly passes, stop and report.

---

## Task 5: Make `Affiliates` page partner rows clickable

**Files:**
- Modify: `frontend/src/pages/Affiliates.tsx`

- [ ] **Step 1: Accept the new prop**

Open `frontend/src/pages/Affiliates.tsx`. Find the existing component signature (around line 47):

```tsx
export const Affiliates: React.FC<{ data: PerformanceRecord[] }> = ({ data }) => {
```

Replace with:

```tsx
interface AffiliatesProps {
  data: PerformanceRecord[];
  onPartnerClick?: (partnerId: string) => void;
}

export const Affiliates: React.FC<AffiliatesProps> = ({ data, onPartnerClick }) => {
```

- [ ] **Step 2: Make the `affiliate_id` cell clickable**

Find where the table renders the `affiliate_id` cell. In `Affiliates.tsx`, look for the row-rendering body — search for `affiliate_id` occurrences inside `<td>` or a cell-mapping loop. The existing code renders `affiliate_id` as plain text inside the row.

Wrap the `affiliate_id` value in a button when `onPartnerClick` is provided. The exact integration depends on the table structure the existing file uses — read the row-render JSX first. Typically it is a pattern like:

```tsx
<td>{row.affiliate_id}</td>
```

Replace with:

```tsx
<td>
  {onPartnerClick && row.affiliate_id ? (
    <button
      type="button"
      className="affiliate-id-link"
      onClick={() => onPartnerClick(String(row.affiliate_id))}
    >
      {row.affiliate_id}
    </button>
  ) : (
    row.affiliate_id
  )}
</td>
```

If the existing file uses a dynamic column renderer (`ALL_COLS.map(...)` pattern), add a special case: when the column key is `'affiliate_id'` and `onPartnerClick` is set, render the button; else the raw value. Adapt faithfully to the existing shape — do NOT rewrite the whole table.

If you cannot cleanly locate the render site, stop and report `NEEDS_CONTEXT` — I'll point you at the exact line.

- [ ] **Step 3: Add the link style**

Append this block to `frontend/src/index.css` at the end of the file:

```css
/* Affiliates table — clickable partner ID */
.affiliate-id-link {
  background: transparent;
  border: none;
  padding: 0;
  color: #00d4ff;
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
  text-align: left;
}
.affiliate-id-link:hover { text-decoration: underline; }
```

- [ ] **Step 4: Type-check and test**

Run: `npm run build`
Expected: clean (Task 4's previous build error is now resolved).

Run: `npm test`
Expected: 39 passing + 0 todos (was 39 after Task 1; no new tests in Tasks 2-5).

- [ ] **Step 5: Commit Tasks 4 + 5 together**

```bash
git add src/App.tsx src/pages/Affiliates.tsx src/index.css
git commit -m "feat(affiliate): drill-through from Affiliates to AffiliateProfile"
```

---

## Task 6: Retrofit `NoMatchingRows` to existing pages (Plan 1 follow-up #3)

Closes the empty-filter-state UX debt: when the filter bar narrows `filteredData` to zero on Overview / Affiliates / Campaigns / Insights / Data, users now see `NoMatchingRows` instead of a blank dashboard.

**Files:**
- Modify: `frontend/src/pages/Overview.tsx`
- Modify: `frontend/src/pages/Affiliates.tsx`
- Modify: `frontend/src/pages/Campaigns.tsx`
- Modify: `frontend/src/pages/Insights.tsx`
- Modify: `frontend/src/pages/Data.tsx`

Each modification is the same shape: early-return `<NoMatchingRows entity="…">` when `data.length === 0`.

- [ ] **Step 1: Overview**

In `frontend/src/pages/Overview.tsx`, add this import at the top (alongside existing imports):

```ts
import { NoMatchingRows } from '../components/NoMatchingRows';
```

Find the start of the `Overview` component body (right after `const { axisColor, axisStroke, tooltipStyle } = useChartColors();` or similar — before the `const handleExport = …` and all the data aggregation `forEach` loops). Add this guard as the FIRST statement after the hooks:

```ts
  if (data.length === 0) return <NoMatchingRows entity="records" />;
```

This short-circuits all downstream computation when there's nothing to show.

- [ ] **Step 2: Affiliates**

In `frontend/src/pages/Affiliates.tsx`, add the import alongside existing imports:

```ts
import { NoMatchingRows } from '../components/NoMatchingRows';
```

Add the guard as the FIRST statement after the hook declarations inside `Affiliates`:

```ts
  if (data.length === 0) return <NoMatchingRows entity="affiliates" />;
```

- [ ] **Step 3: Campaigns**

In `frontend/src/pages/Campaigns.tsx`, add the import and add this as the first statement after the component's hook declarations:

```ts
import { NoMatchingRows } from '../components/NoMatchingRows';
// … inside the component body, after hooks:
  if (data.length === 0) return <NoMatchingRows entity="campaigns" />;
```

- [ ] **Step 4: Insights**

In `frontend/src/pages/Insights.tsx`:

```ts
import { NoMatchingRows } from '../components/NoMatchingRows';
// … inside the component body, after hooks:
  if (data.length === 0) return <NoMatchingRows entity="insights" />;
```

- [ ] **Step 5: Data**

In `frontend/src/pages/Data.tsx`:

```ts
import { NoMatchingRows } from '../components/NoMatchingRows';
// … inside the component body, after hooks:
  if (data.length === 0) return <NoMatchingRows entity="rows" />;
```

- [ ] **Step 6: Type-check and test**

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: 39 passing + 0 todos.

- [ ] **Step 7: Manual smoke — skip for implementer**

The implementer does NOT run the dev server. The user will verify by:
1. Upload the workbook.
2. Apply a filter that yields zero rows (e.g. a brand that doesn't exist).
3. Tab through Overview / Affiliates / Campaigns / Insights / Data — each should show the `NoMatchingRows` banner.
4. Click a partner on Affiliates → `AffiliateProfile` opens; click Back → returns to Affiliates with filters preserved.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Overview.tsx src/pages/Affiliates.tsx src/pages/Campaigns.tsx src/pages/Insights.tsx src/pages/Data.tsx
git commit -m "feat(ui): show NoMatchingRows on existing pages when filters narrow to zero"
```

---

## Self-Review Notes

**1. Spec coverage:**
- Per-affiliate detail view → Task 3 ✓
- Drill-through from Affiliates → Tasks 4 + 5 ✓
- Header: Partner ID, Company, AM, dates, brand mix, country mix → Task 2 ✓
- KPI strip (same 12 as Overview) → Task 3 ✓
- Time series → Task 3 ✓
- Sub-pivots by brand + country → Task 3 ✓
- Back button → Task 2 (`AffiliateHeader.onBack`) + Task 4 (`closeAffiliateProfile`) ✓
- Filter bar auto-carries (no URL sync) → Task 3 uses `filteredData` directly ✓
- Plan 1 follow-up #3 (empty-state retrofit) → Task 6 ✓

**2. Placeholder scan:** no TBD / "handle edge cases" / "similar to Task N" — every step has concrete code.

**3. Type consistency:**
- `AffiliateMeta` shape in Task 1 is consumed byte-identically in Task 2 (`AffiliateHeader`) and Task 3 (`AffiliateProfile`).
- `PivotTable` + `pivotAggregate` from Plan 2 are reused in Task 3 for brand / country sub-pivots.
- `NoMatchingRows` from Plan 2 Task 2 is reused in Task 3 (partner with zero filtered rows) and Task 6 (empty state across 5 existing pages).
- `AffiliatesProps.onPartnerClick` in Task 5 matches the call in Task 4's App.tsx (`onPartnerClick={openAffiliateProfile}`).
- `openAffiliateProfile(partnerId: string)` in Task 4 and `onPartnerClick?: (partnerId: string) => void` in Task 5 are the same signature.
- `'AffiliateProfile'` as the virtual tab name is used consistently in Task 4 (`setActiveTab('AffiliateProfile')` and `activeTab === 'AffiliateProfile'`).
