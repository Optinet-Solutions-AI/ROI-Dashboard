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
