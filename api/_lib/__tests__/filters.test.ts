import { describe, it, expect } from 'vitest';
import { buildWhereClause } from '../tools/_filters.js';
import { TOOL_SCHEMAS } from '../tools/index.js';

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

describe('tool schema / runtime allow-list parity', () => {
  it('FILTERS_SCHEMA lists every runtime filter key', () => {
    // Pull FILTERS_SCHEMA out of any tool that uses it (e.g., get_kpi_summary).
    const kpiTool = TOOL_SCHEMAS.find(t => t.function.name === 'get_kpi_summary');
    const filtersSchema = (kpiTool as any)?.function.parameters.properties.filters;
    const schemaKeys = Object.keys(filtersSchema.properties).sort();

    const expected = [
      'affiliate_id','affiliate_name','company_name',
      'country','player_country','campaign',
      'brand','am','source','problematic_source',
      'period','ftd_month','date_from','date_to',
    ].sort();

    expect(schemaKeys).toEqual(expected);
  });

  it('DIM_ENUM lists every allowed group-by dimension', () => {
    const topTool = TOOL_SCHEMAS.find(t => t.function.name === 'get_top_n');
    const dimEnum = (topTool as any)?.function.parameters.properties.dimension;
    const dims = [...dimEnum.enum].sort();

    const expected = [
      'affiliate_id','affiliate_name','company_name',
      'country','player_country','campaign',
      'brand','am','source','problematic_source',
    ].sort();

    expect(dims).toEqual(expected);
  });
});
