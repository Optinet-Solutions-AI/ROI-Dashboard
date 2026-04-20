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
  it.todo('add fixture-based roundtrip once a tiny .xlsx is checked in');
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
