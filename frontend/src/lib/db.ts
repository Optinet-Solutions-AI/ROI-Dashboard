import { supabase } from './supabase'
import type { PerformanceRecord } from '../utils/kpiEngine'

const TABLE = 'performance_records'

// All columns defined in supabase-setup.sql (keep in sync with that schema)
const COLUMNS = [
  'affiliate_id', 'affiliate_name', 'company_name',
  'country', 'player_country', 'campaign',
  'brand', 'am', 'source', 'problematic_source',
  'period', 'date', 'ftd_month',
  'clicks', 'registrations', 'ftds', 'revenue', 'cost',
  'casino_real_ngr', 'sb_real_ngr', 'flats_and_adjustments',
] as const

function toRow(record: PerformanceRecord) {
  const row: Record<string, unknown> = {}
  COLUMNS.forEach(col => {
    if (record[col] !== undefined) row[col] = record[col]
  })
  return row
}

/** Load all saved records from Supabase */
export async function fetchRecords(): Promise<PerformanceRecord[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS.join(', '))
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as PerformanceRecord[]
}

/** Replace all records with a new dataset (batched to handle large files) */
export async function replaceRecords(records: PerformanceRecord[]): Promise<void> {
  const { error: delError } = await supabase
    .from(TABLE)
    .delete()
    .gte('id', 0)

  if (delError) throw delError

  const BATCH_SIZE = 500
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE).map(toRow)
    const { error } = await supabase.from(TABLE).insert(batch)
    if (error) throw error
  }
}

/** Append new records to the existing dataset without deleting anything */
export async function appendRecords(records: PerformanceRecord[]): Promise<void> {
  const BATCH_SIZE = 500
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE).map(toRow)
    const { error } = await supabase.from(TABLE).insert(batch)
    if (error) throw error
  }
}

/** Delete all rows from performance_records */
export async function clearRecords(): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .gte('id', 0)
  if (error) throw error
}

/** Bulk insert records without deleting first — call clearRecords() beforehand if a fresh upload is needed */
export async function insertRecords(records: PerformanceRecord[]): Promise<void> {
  const BATCH_SIZE = 500
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE).map(toRow)
    const { error } = await supabase.from(TABLE).insert(batch)
    if (error) throw error
  }
}
