# Affiliate Filter Checkbox List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text-search input in `affiliate_name` and `affiliate_id` column filter popovers with a scrollable multi-select checkbox list sourced from the table data.

**Architecture:** Single-file change to `frontend/src/pages/Affiliates.tsx`. The `ColumnFilters` type for text columns changes from `string` to `string[]`, filter logic changes from substring match to set membership, and the popover UI for text columns renders a scrollable checkbox list instead of a text input.

**Tech Stack:** React, TypeScript (no test suite — verify in browser after each task)

---

### Task 1: Update `ColumnFilters` type and defaults

**Files:**
- Modify: `frontend/src/pages/Affiliates.tsx:17-31`

- [ ] **Step 1: Update the `ColumnFilters` type**

In [Affiliates.tsx:17](frontend/src/pages/Affiliates.tsx#L17), change:

```ts
type ColumnFilters = Record<TextColKey, string> & Record<NumericColKey, { min: string; max: string }>;
```

to:

```ts
type ColumnFilters = Record<TextColKey, string[]> & Record<NumericColKey, { min: string; max: string }>;
```

- [ ] **Step 2: Update `DEFAULT_COL_FILTERS` text defaults**

In [Affiliates.tsx:21-31](frontend/src/pages/Affiliates.tsx#L21-L31), change:

```ts
const DEFAULT_COL_FILTERS: ColumnFilters = {
  affiliate_name: '',
  affiliate_id:   '',
  clicks:  { min: '', max: '' },
  ftds:    { min: '', max: '' },
  revenue: { min: '', max: '' },
  cost:    { min: '', max: '' },
  profit:  { min: '', max: '' },
  roi:     { min: '', max: '' },
  cpa:     { min: '', max: '' },
};
```

to:

```ts
const DEFAULT_COL_FILTERS: ColumnFilters = {
  affiliate_name: [],
  affiliate_id:   [],
  clicks:  { min: '', max: '' },
  ftds:    { min: '', max: '' },
  revenue: { min: '', max: '' },
  cost:    { min: '', max: '' },
  profit:  { min: '', max: '' },
  roi:     { min: '', max: '' },
  cpa:     { min: '', max: '' },
};
```

---

### Task 2: Update helper functions

**Files:**
- Modify: `frontend/src/pages/Affiliates.tsx:166-189`

- [ ] **Step 1: Update `isColActive` for text columns**

In [Affiliates.tsx:167-169](frontend/src/pages/Affiliates.tsx#L167-L169), change:

```ts
if (TEXT_COLS.includes(col as TextColKey)) {
  return (colFilters[col as TextColKey] as string).trim() !== '';
}
```

to:

```ts
if (TEXT_COLS.includes(col as TextColKey)) {
  return (colFilters[col as TextColKey] as string[]).length > 0;
}
```

- [ ] **Step 2: Update `clearCol` for text columns**

In [Affiliates.tsx:174-178](frontend/src/pages/Affiliates.tsx#L174-L178), change:

```ts
const clearCol = (col: string) =>
  setColFilters(prev => ({
    ...prev,
    [col]: TEXT_COLS.includes(col as TextColKey) ? '' : { min: '', max: '' },
  }));
```

to:

```ts
const clearCol = (col: string) =>
  setColFilters(prev => ({
    ...prev,
    [col]: TEXT_COLS.includes(col as TextColKey) ? [] : { min: '', max: '' },
  }));
```

- [ ] **Step 3: Replace `updateText` with `toggleListItem`**

In [Affiliates.tsx:182-183](frontend/src/pages/Affiliates.tsx#L182-L183), remove:

```ts
const updateText = (col: TextColKey, val: string) =>
  setColFilters(prev => ({ ...prev, [col]: val }));
```

And replace with:

```ts
const toggleListItem = (col: TextColKey, val: string) =>
  setColFilters(prev => {
    const arr = prev[col] as string[];
    return {
      ...prev,
      [col]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val],
    };
  });
```

---

### Task 3: Update filter logic

**Files:**
- Modify: `frontend/src/pages/Affiliates.tsx:130-158`

- [ ] **Step 1: Update `affiliate_name` filter**

In [Affiliates.tsx:133-135](frontend/src/pages/Affiliates.tsx#L133-L135), change:

```ts
if (colFilters.affiliate_name.trim()) {
  const q = colFilters.affiliate_name.toLowerCase();
  result = result.filter(r => String(r.affiliate_name ?? '').toLowerCase().includes(q));
}
```

to:

```ts
if (colFilters.affiliate_name.length > 0) {
  result = result.filter(r => colFilters.affiliate_name.includes(String(r.affiliate_name ?? '')));
}
```

- [ ] **Step 2: Update `affiliate_id` filter**

In [Affiliates.tsx:136-139](frontend/src/pages/Affiliates.tsx#L136-L139), change:

```ts
if (colFilters.affiliate_id.trim()) {
  const q = colFilters.affiliate_id.toLowerCase();
  result = result.filter(r => String(r.affiliate_id ?? '').toLowerCase().includes(q));
}
```

to:

```ts
if (colFilters.affiliate_id.length > 0) {
  result = result.filter(r => colFilters.affiliate_id.includes(String(r.affiliate_id ?? '')));
}
```

---

### Task 4: Replace text input with checkbox list in popover UI

**Files:**
- Modify: `frontend/src/pages/Affiliates.tsx:252-259` (the `isText` branch in `Th`)

- [ ] **Step 1: Derive sorted unique values for the column above the `Th` component definition**

Just before the `Th` component definition (around [Affiliates.tsx:192](frontend/src/pages/Affiliates.tsx#L192)), add a helper that computes unique values for a given text column from `tableData`:

```ts
const getUniqueValues = (col: TextColKey): string[] =>
  Array.from(new Set(tableData.map(r => String(r[col] ?? '')).filter(Boolean))).sort();
```

- [ ] **Step 2: Replace the text input branch in the `Th` popover**

In [Affiliates.tsx:252-259](frontend/src/pages/Affiliates.tsx#L252-L259), replace:

```tsx
{isText ? (
  <input
    type="text"
    placeholder={`Search ${label.toLowerCase()}…`}
    value={colFilters[col as TextColKey] as string}
    onChange={e => updateText(col as TextColKey, e.target.value)}
    autoFocus
    style={popInputStyle}
  />
) : (
```

with:

```tsx
{isText ? (
  <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
    {getUniqueValues(col as TextColKey).map(val => {
      const checked = (colFilters[col as TextColKey] as string[]).includes(val);
      return (
        <label
          key={val}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 2px', cursor: 'pointer', fontSize: '0.8rem',
            color: checked ? 'var(--text-primary)' : 'var(--text-muted)',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={() => toggleListItem(col as TextColKey, val)}
            style={{ accentColor: 'var(--accent, #00d4ff)', width: 13, height: 13, cursor: 'pointer', flexShrink: 0 }}
          />
          {val}
        </label>
      );
    })}
    {getUniqueValues(col as TextColKey).length === 0 && (
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No values</span>
    )}
  </div>
) : (
```

---

### Task 5: Verify and commit

**Files:**
- No new files

- [ ] **Step 1: Run the dev server and verify**

```bash
cd frontend && npm run dev
```

Open the Affiliates page. Click the filter icon on "Affiliate Name" — confirm a scrollable checkbox list appears with all affiliate names. Check one or more — confirm the table filters to only those affiliates. Click "Clear" — confirm all rows return.

Repeat for "Affiliate ID" column. Confirm numeric column filter popovers (Clicks, FTDs, etc.) are unchanged.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Affiliates.tsx
git commit -m "feat: replace text search with checkbox list in affiliate column filters"
```
