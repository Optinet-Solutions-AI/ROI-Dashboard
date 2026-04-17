# Affiliate Filter — Checkbox List Design

**Date:** 2026-04-17  
**Status:** Approved

## Overview

Replace the text-search input in the `affiliate_name` and `affiliate_id` column filter popovers with a scrollable multi-select checkbox list. Clicking items filters the table to only rows matching any selected value.

## Scope

Only the two text columns (`affiliate_name`, `affiliate_id`) are changed. Numeric column filters (min/max range inputs) are unchanged.

## Data Model Changes

`ColumnFilters` type changes for text columns:

```ts
// Before
type ColumnFilters = Record<TextColKey, string> & Record<NumericColKey, { min: string; max: string }>;

// After
type ColumnFilters = Record<TextColKey, string[]> & Record<NumericColKey, { min: string; max: string }>;
```

Default values change from `''` to `[]`:

```ts
const DEFAULT_COL_FILTERS = {
  affiliate_name: [],
  affiliate_id:   [],
  // numeric cols unchanged
};
```

## Filter Logic

```ts
// Before (substring match)
if (colFilters.affiliate_name.trim()) {
  result = result.filter(r => String(r.affiliate_name).toLowerCase().includes(q));
}

// After (set membership)
if (colFilters.affiliate_name.length > 0) {
  result = result.filter(r => colFilters.affiliate_name.includes(String(r.affiliate_name ?? '')));
}
```

Same pattern for `affiliate_id`.

## Popover UI (text columns)

When the filter popover opens for a text column, instead of an `<input type="text">`, render:

```
┌──────────────────────────┐
│ AFFILIATE NAME     Clear │  ← existing header row
├──────────────────────────┤
│ ☐  Acme Corp             │
│ ☑  Beta Media            │  ← checked = selected
│ ☐  Gamma LLC             │
│ ...                      │
└──────────────────────────┘
  max-height: 220px, overflow-y: auto
```

- Each row: `<label>` with `<input type="checkbox">` + value text
- Checked when `colFilters[col]` array includes that value
- Toggling adds/removes the value from the array
- Values sourced from `tableData` (full unfiltered list), sorted alphabetically
- "Clear" button in the header deselects all (sets array to `[]`)

## `isColActive` helper

```ts
// Before
(colFilters[col as TextColKey] as string).trim() !== ''

// After
(colFilters[col as TextColKey] as string[]).length > 0
```

## `updateText` helper → `toggleListItem`

Remove `updateText`. Add:

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

## No Changes

- Numeric column filter popovers (min/max inputs) — unchanged
- The global search bar above the table — unchanged
- Column visibility, export, pagination — unchanged

## Self-Review

- No placeholders or TODOs
- Type changes are consistent across all usage sites
- Scope is tightly bounded to the two text column filter popovers
