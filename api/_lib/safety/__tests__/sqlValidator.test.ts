// api/_lib/safety/__tests__/sqlValidator.test.ts
import { describe, it, expect } from 'vitest';
import { validateSql } from '../sqlValidator.js';

describe('validateSql — accepts safe SELECTs', () => {
  it('accepts a basic SELECT against the allowlist', () => {
    const r = validateSql('SELECT brand, count(*) FROM performance_records GROUP BY brand');
    expect(r.ok).toBe(true);
  });

  it('accepts a SELECT with public.performance_records', () => {
    const r = validateSql('SELECT 1 FROM public.performance_records LIMIT 10');
    expect(r.ok).toBe(true);
  });

  it('auto-injects LIMIT 500 when missing', () => {
    const r = validateSql('SELECT * FROM performance_records');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sql).toMatch(/LIMIT\s+500/i);
  });

  it('caps LIMIT to 500 when larger', () => {
    const r = validateSql('SELECT * FROM performance_records LIMIT 9999');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sql).toMatch(/LIMIT\s+500/i);
  });

  it('preserves a smaller LIMIT', () => {
    const r = validateSql('SELECT * FROM performance_records LIMIT 50');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sql).toMatch(/LIMIT\s+50\b/i);
  });
});

describe('validateSql — rejects mutations', () => {
  for (const sql of [
    'INSERT INTO performance_records (brand) VALUES (\'x\')',
    'UPDATE performance_records SET brand = \'x\'',
    'DELETE FROM performance_records',
    'TRUNCATE performance_records',
    'DROP TABLE performance_records',
    'ALTER TABLE performance_records ADD COLUMN foo text',
    'CREATE TABLE foo (id int)',
    'GRANT ALL ON performance_records TO anon',
  ]) {
    it(`rejects: ${sql.slice(0, 40)}…`, () => {
      const r = validateSql(sql);
      expect(r.ok).toBe(false);
    });
  }
});

describe('validateSql — rejects schema escape', () => {
  for (const sql of [
    'SELECT * FROM ask_ai_logs',
    'SELECT * FROM information_schema.tables',
    'SELECT * FROM pg_catalog.pg_tables',
    'SELECT * FROM pg_user',
    'SELECT * FROM auth.users',
    'SELECT * FROM storage.objects',
    'SELECT * FROM users',                       // not in allowlist
    'SELECT * FROM performance_records, ask_ai_logs',
  ]) {
    it(`rejects: ${sql.slice(0, 50)}…`, () => {
      const r = validateSql(sql);
      expect(r.ok).toBe(false);
    });
  }
});

describe('validateSql — rejects multi-statement', () => {
  it('rejects two SELECTs', () => {
    const r = validateSql('SELECT 1 FROM performance_records; SELECT 2 FROM performance_records');
    expect(r.ok).toBe(false);
  });

  it('rejects SELECT then DELETE', () => {
    const r = validateSql('SELECT 1 FROM performance_records; DELETE FROM performance_records');
    expect(r.ok).toBe(false);
  });
});

describe('validateSql — rejects malformed', () => {
  it('rejects empty', () => {
    expect(validateSql('').ok).toBe(false);
  });

  it('rejects gibberish', () => {
    expect(validateSql('not sql at all').ok).toBe(false);
  });
});
