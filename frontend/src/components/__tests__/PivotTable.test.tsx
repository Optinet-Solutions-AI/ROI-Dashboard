import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PivotTable } from '../PivotView/PivotTable';
import type { PivotRow } from '../../utils/pivotAggregate';
import { processKPIs } from '../../utils/kpiEngine';

afterEach(cleanup);

function row(key: string, revenue: number, ftds: number): PivotRow {
  const fakeData = [{ revenue, ftds, cost: 0, casino_real_ngr: 0, sb_real_ngr: 0, flats_and_adjustments: 0, clicks: 0, registrations: 0 }];
  return { key, count: 1, kpis: processKPIs(fakeData) };
}

describe('PivotTable', () => {
  const rows: PivotRow[] = [
    row('A', 100, 1),
    row('B', 300, 3),
    row('C', 200, 2),
  ];

  it('defaults to sorting by revenue desc', () => {
    render(<PivotTable rowLabel="Key" rows={rows} data={[]} />);
    const tbodyRows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
    expect(tbodyRows[0].textContent?.startsWith('B')).toBe(true);
    expect(tbodyRows[1].textContent?.startsWith('C')).toBe(true);
    expect(tbodyRows[2].textContent?.startsWith('A')).toBe(true);
  });

  it('toggles sort direction when the same header is clicked twice', async () => {
    const user = userEvent.setup();
    render(<PivotTable rowLabel="Key" rows={rows} data={[]} />);

    // First click on Deposits flips from initial desc → asc.
    await user.click(screen.getByText('Deposits'));
    let tbodyRows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
    expect(tbodyRows[0].textContent?.startsWith('A')).toBe(true);

    // Second click flips back to desc.
    await user.click(screen.getByText('Deposits'));
    tbodyRows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
    expect(tbodyRows[0].textContent?.startsWith('B')).toBe(true);
  });

  it('sorts alphabetically ascending when the Key header is clicked', async () => {
    const user = userEvent.setup();
    render(<PivotTable rowLabel="Key" rows={rows} data={[]} />);
    await user.click(screen.getByText('Key'));
    const tbodyRows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
    expect(tbodyRows[0].textContent?.startsWith('A')).toBe(true);
    expect(tbodyRows[2].textContent?.startsWith('C')).toBe(true);
  });
});
