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
