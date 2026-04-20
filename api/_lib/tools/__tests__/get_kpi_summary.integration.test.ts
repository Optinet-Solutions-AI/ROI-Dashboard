import { describe, it, expect } from 'vitest';
import { getKpiSummary } from '../get_kpi_summary.js';

const skip = !process.env.ASK_AI_READONLY_DATABASE_URL;
const d = skip ? describe.skip : describe;

d('get_kpi_summary (integration)', () => {
  it('returns one totals row', async () => {
    const r = await getKpiSummary({ filters: {} });
    expect(r.rows).toHaveLength(1);
    expect(typeof (r.rows[0] as any).revenue).toBe('number');
  });

  it('groups by brand', async () => {
    const r = await getKpiSummary({ filters: {}, group_by: ['brand'] });
    if (r.rows.length > 0) {
      expect(r.rows[0]).toHaveProperty('brand');
    }
  });
});
