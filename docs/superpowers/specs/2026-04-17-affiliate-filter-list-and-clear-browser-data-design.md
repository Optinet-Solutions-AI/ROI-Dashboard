# Design: Affiliate Name Filter → List + Clear Data Wipes Browser Storage

**Date:** 2026-04-17
**Status:** Approved

---

## Overview

Two independent UI improvements to the Affiliates page and the global Clear Data action:

1. Replace the free-text search input in the Affiliate Name column filter popover with a searchable single-select list of known affiliate names.
2. Extend the "Clear Data" action to wipe all browser storage (localStorage, cookies, Cache API) and reload the page for a clean slate.

---

## Change 1 — Affiliate Name Filter: Searchable List

### Scope
File: `frontend/src/pages/Affiliates.tsx`

### Current Behavior
Clicking the filter icon on the "Affiliate Name" column header opens a popover with a plain `<input type="text">` that does a partial (`includes()`) match against affiliate names.

### New Behavior
The popover for the `affiliate_name` column is replaced with:

1. **Search-within-list input** — a small `<input>` at the top of the popover (placeholder: "Search…"). This input only narrows the visible list items; it does not directly filter the table.
2. **Scrollable list** — all unique affiliate names derived from `tableData`, rendered as clickable rows. Max-height ~200px, overflow-y auto.
3. **Single-select interaction** — clicking a name sets `colFilters.affiliate_name` to that exact value and closes the popover. Clicking the already-selected name deselects (clears) it.
4. **Active highlight** — the selected item is visually highlighted with the accent color background and bold text.
5. **Existing "Clear" button** in the popover header continues to work — resets `colFilters.affiliate_name` to `''`.

### Filter Logic Change
- `affiliate_name` filter switches from partial match (`includes()`) to exact match (`===`) since the user selects from a known list.
- `affiliate_id` column is unchanged — keeps its existing text-search input.

### Data Source
Unique names are derived at render time from `tableData` (the already-aggregated, already-sorted affiliate rows), so the list always reflects the current dataset.

---

## Change 2 — Clear Data: Wipe All Browser Storage

### Scope
- `frontend/src/App.tsx` — `handleClearData` function
- `frontend/src/components/Sidebar.tsx` — confirm dialog message

### Current Behavior
"Clear Data" clears IndexedDB (`clearIDB()`) and Supabase records (`clearRecords()`), then resets the in-memory `data` state to `[]`.

### New Behavior
After the existing IDB + Supabase clears, also:

1. `localStorage.clear()` — removes theme preference and any other stored settings.
2. Cookie clear — iterate `document.cookie`, set each to expired (`Max-Age=0`) to remove all cookies on the current domain.
3. Cache API clear — call `caches.keys()` and delete each cache (clears any service worker or browser cache entries).
4. `window.location.reload()` — hard reload so the app re-initializes with no leftover in-memory state and re-applies any defaults from scratch.

### Confirm Dialog Update
The confirmation message in `Sidebar.tsx` is updated to:

> "This will remove all records and clear all browser data (storage, cookies, cache). This cannot be undone."

This ensures the user understands the full scope before confirming.

---

## Out of Scope
- No changes to the `affiliate_id` filter.
- No changes to numeric column filters (min/max range inputs).
- No changes to the column visibility toggle or export functionality.
- No server-side session clearing (only browser-side storage).
