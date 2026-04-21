// Map Excel header variants to canonical DB column names.
// Keep `company_name` and `player_country` as separate fields — the ROI
// workbook uses them as distinct pivot dimensions and collapsing them
// into affiliate_name / country loses filter granularity.
const COLUMN_ALIASES: Record<string, string> = {
  partner_id:                'affiliate_id',
  partner_name:              'affiliate_name',
  affiliate:                 'affiliate_id',
  // "Company_name_f" is the workbook's formatted/denormalized company-name column.
  company_name_f:            'company_name',
  campaign_name:             'campaign',
  stats_date:                'date',
  fd_date:                   'date',
  ftd_count:                 'ftds',
  ftd:                       'ftds',
  deposits_sum:              'revenue',
  partner_income:            'cost',
  flat_amt:                  'flats_and_adjustments',
  flats_and_adjustments_col: 'flats_and_adjustments',
};

/**
 * Extract YYYY-MM from a date-ish string. Returns undefined if the input
 * can't be parsed as a date — the Excel workbook uses "FTD month" as a
 * row grouping of FD_Date, so populating this lets us filter/group by
 * month without re-parsing dates on every render.
 */
export const deriveFtdMonth = (value: unknown): string | undefined => {
  if (value == null || value === '') return undefined;
  const str = String(value).trim();
  const match = /^(\d{4})-(\d{2})/.exec(str);
  return match ? `${match[1]}-${match[2]}` : undefined;
};

export const normalizeColumnName = (name: string): string => {
  return name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/_$/, '');
};

/**
 * Clean currency / percentage strings into plain numbers.
 * - "€ 1,174,638"  → 1174638
 * - "-€ 4,639"     → -4639
 * - "35%"          → 0.35
 * - 42 (number)    → 42
 * - "Partner_ID"   → "Partner_ID"  (non-numeric strings pass through)
 * - "2026-03-01"   → "2026-03-01" (date strings pass through)
 */
const cleanNumeric = (str: string): string =>
  str
    .replace(/[−–—]/g, '-')          // normalize em/en dashes to ASCII minus
    .replace(/[€$£¥₹\xA0\s]/g, '')  // strip currency symbols and spaces (incl. non-breaking)
    .replace(/,/g, '');              // strip thousands separators

const parseNumericValue = (val: any): any => {
  if (typeof val === 'number') return val;
  if (val == null || val === '') return val;
  const str = String(val).trim();

  // Percentage string like "35%" → 0.35
  if (str.endsWith('%')) {
    const n = parseFloat(cleanNumeric(str.slice(0, -1)));
    return isNaN(n) ? 0 : n / 100;
  }

  // Date-like strings — preserve as-is so chart x-axes stay readable
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str;

  const cleaned = cleanNumeric(str);
  const n = parseFloat(cleaned);
  return isNaN(n) ? str : n;
};

/**
 * Some pivot/summary exports (like the ROI report) prefix several rows of
 * filter metadata before the actual column-header row.  We scan the first
 * 20 rows looking for a row that contains at least 2 of our known column
 * name fragments, then treat that row as the real header.
 */
const HEADER_INDICATORS = ['ftd', 'deposits', 'stats_date', 'clicks', 'date', 'registrations', 'month'];

const findHeaderRowIndex = (rows: any[][]): number => {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const cells = row.map((c: any) => String(c ?? '').toLowerCase().trim());
    const matchCount = HEADER_INDICATORS.filter(ind => cells.some(c => c.includes(ind))).length;
    if (matchCount >= 2) return i;
  }
  return 0; // fallback — first row is the header
};

/** Skip aggregate summary rows that would skew KPI totals. */
const isGrandTotalRow = (row: Record<string, any>): boolean =>
  Object.values(row).some(v => String(v ?? '').toLowerCase().includes('grand total'));

export const parseExcelFile = async (file: File): Promise<any[]> => {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        // type:'array' + Uint8Array is significantly faster than readAsBinaryString / type:'binary'
        const workbook = XLSX.read(new Uint8Array(data), {
          type: 'array',
          cellDates: true,
          dateNF: 'yyyy-mm-dd',
        });

        const allData: any[] = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];

          // First pass: get raw rows to detect header offset
          const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
          const headerRowIdx = findHeaderRowIndex(rawRows);

          let jsonRows: Record<string, any>[];

          if (headerRowIdx > 0) {
            // Re-parse starting from the detected header row
            const headerRow = rawRows[headerRowIdx] as any[];
            jsonRows = rawRows.slice(headerRowIdx + 1).map(row => {
              if (!row || row.length === 0) return null;
              const obj: Record<string, any> = {};
              headerRow.forEach((key: any, idx: number) => {
                const k = String(key ?? '').trim();
                if (k !== '') obj[k] = row[idx] ?? null;
              });
              return obj;
            }).filter(Boolean) as Record<string, any>[];
          } else {
            jsonRows = XLSX.utils.sheet_to_json(sheet, { raw: false }) as Record<string, any>[];
          }

          for (const row of jsonRows) {
            if (isGrandTotalRow(row)) continue;

            const newRow: Record<string, any> = {};
            for (const key in row) {
              const normKey   = normalizeColumnName(key);
              const aliasedKey = COLUMN_ALIASES[normKey] ?? normKey;
              newRow[aliasedKey] = parseNumericValue(row[key]);
            }

            // Derive ftd_month from the canonical date column so it is available
            // as a filter/grouping dimension without re-parsing at render time.
            if (newRow.date && !newRow.ftd_month) {
              const month = deriveFtdMonth(newRow.date);
              if (month) newRow.ftd_month = month;
            }

            // Derive period (months since FTD) from date and ftd_month when not
            // explicitly provided by the workbook. Stored so Supabase rows have
            // it pre-computed and the cohort chart can group without re-deriving.
            if (newRow.date && newRow.ftd_month && newRow.period == null) {
              const dm = /^(\d{4})-(\d{2})/.exec(String(newRow.date));
              const fm = /^(\d{4})-(\d{2})/.exec(String(newRow.ftd_month));
              if (dm && fm) {
                newRow.period = (Number(dm[1]) - Number(fm[1])) * 12 + (Number(dm[2]) - Number(fm[2]));
              }
            }

            // problematic_source in the workbook is 0/1 — make sure it's numeric.
            // Use Number() (not parseFloat) for strictness: "1 affiliate" should reject.
            // Empty or whitespace-only strings are treated as absent (not promoted to 0).
            if (newRow.problematic_source != null && typeof newRow.problematic_source !== 'number') {
              const raw = String(newRow.problematic_source).trim();
              if (raw === '') {
                newRow.problematic_source = undefined;
              } else {
                const n = Number(raw);
                newRow.problematic_source = Number.isFinite(n) ? n : undefined;
              }
            }

            // Skip entirely blank rows
            if (Object.values(newRow).every(v => v == null || v === '')) continue;

            allData.push(newRow);
          }
        }

        resolve(allData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file); // ~3-5× faster than readAsBinaryString for large files
  });
};
