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

  it('returns undefined for Excel numeric serial dates (raw: true workbooks)', () => {
    expect(deriveFtdMonth(46081)).toBeUndefined();
  });

  it('returns undefined for Date objects (parser must stringify upstream)', () => {
    expect(deriveFtdMonth(new Date('2026-03-15'))).toBeUndefined();
  });
});
