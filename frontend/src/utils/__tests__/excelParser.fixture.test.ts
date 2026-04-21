import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcelFile } from '../excelParser';

/**
 * Build an in-memory .xlsx with a native Excel Date cell plus the other
 * filter-parity columns, write it to a Uint8Array, wrap that in a File,
 * and round-trip it through parseExcelFile. This is the regression guard
 * for the XLSX.read dateNF/cellDates contract.
 */
function buildWorkbook(): Uint8Array {
  const aoa = [
    ['Partner_ID', 'Company_name', 'Player_country', 'FD_Date', 'Brand', 'AM', 'Source', 'Period', 'problematic_source', 'FTD', 'Deposits_sum', 'Partner_income'],
    [173343,       'Acme Ltd',      'DE',             new Date(Date.UTC(2026, 2, 15)), 'SP', 'Gemma', 'FP', 0, 0, 5, 1000, 400],
    [161653,       'Beta Inc',      'AT',             new Date(Date.UTC(2026, 1, 1)),  'L7', 'Charisse', 'L7', 1, 1, 3, 600, 250],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const book  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Data');
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' });
}

function toFile(bytes: Uint8Array, name = 'fixture.xlsx'): File {
  // XLSX.write returns Uint8Array<ArrayBufferLike>; TS 6's strict BlobPart
  // typing requires Uint8Array<ArrayBuffer>. Copying via `new Uint8Array(bytes)`
  // allocates a fresh ArrayBuffer-backed view that satisfies the structural check
  // AND preserves the byte payload (unlike wrapping the raw ArrayBuffer, which
  // behaves inconsistently in jsdom's File/Blob implementation).
  return new File([new Uint8Array(bytes)], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('parseExcelFile — fixture round-trip', () => {
  it('emits ISO date strings for native Excel Date cells', async () => {
    const rows = await parseExcelFile(toFile(buildWorkbook()));

    expect(rows).toHaveLength(2);

    const row0 = rows[0];
    expect(row0.date).toBe('2026-03-15');
    expect(row0.ftd_month).toBe('2026-03');
  });

  it('keeps company_name and player_country distinct from affiliate_name and country', async () => {
    const rows = await parseExcelFile(toFile(buildWorkbook()));
    const row0 = rows[0];

    expect(row0.company_name).toBe('Acme Ltd');
    expect(row0.player_country).toBe('DE');
    // affiliate_name is not populated by this fixture (no Partner_name column),
    // so it must remain undefined — proving the aliases do NOT collapse fields.
    expect(row0.affiliate_name).toBeUndefined();
    // Likewise country (general) should NOT be populated from player_country.
    expect(row0.country).toBeUndefined();
  });

  it('coerces problematic_source to a number (0 or 1)', async () => {
    const rows = await parseExcelFile(toFile(buildWorkbook()));
    expect(rows[0].problematic_source).toBe(0);
    expect(rows[1].problematic_source).toBe(1);
    expect(typeof rows[0].problematic_source).toBe('number');
  });

  it('preserves Partner_ID as affiliate_id', async () => {
    const rows = await parseExcelFile(toFile(buildWorkbook()));
    expect(String(rows[0].affiliate_id)).toBe('173343');
    expect(String(rows[1].affiliate_id)).toBe('161653');
  });
});
