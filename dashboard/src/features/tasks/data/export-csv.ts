import { type Task } from './schema'

// Flattens an approved record's `details` jsonb into a flat CSV row that can be
// imported into a TMS.
//
// Column order mirrors processor.FREIGHT_FIELDS so an import template can be
// mapped once and reused. `title` carries carrier_name because the poller
// deliberately moves carrier_name out of `details` into `title`.
export type ExportColumn = { header: string; key: string; alt?: string }

export const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'carrier_name', key: 'title' },
  { header: 'carrier_mc', key: 'carrier_mc' },
  { header: 'customer_name', key: 'customer_name' },
  { header: 'load_id', key: 'load_id' },
  { header: 'carrier_pro', key: 'carrier_pro' },
  { header: 'customer_po', key: 'customer_po' },
  { header: 'document_type', key: 'document_type' },
  { header: 'pickup_date', key: 'pickup_date' },
  { header: 'delivery_date', key: 'delivery_date' },
  { header: 'origin_city', key: 'origin_city' },
  { header: 'origin_state', key: 'origin_state' },
  { header: 'origin_zip', key: 'origin_zip' },
  { header: 'destination_city', key: 'destination_city' },
  { header: 'destination_state', key: 'destination_state' },
  { header: 'destination_zip', key: 'destination_zip' },
  { header: 'equipment_type', key: 'equipment_type' },
  { header: 'commodity', key: 'commodity' },
  { header: 'weight', key: 'weight' },
  { header: 'pieces', key: 'pieces' },
  { header: 'total_rate', key: 'total_rate' },
  { header: 'rate_type', key: 'rate_type' },
  { header: 'miles', key: 'miles' },
  { header: 'fsc', key: 'fsc' },
  { header: 'detention_rate', key: 'detention_rate' },
  // processor.EXTRACTION_PROMPT asks the model for "lumpter_fee" (typo) while
  // FREIGHT_FIELDS expects "lumper_fee", so accept either key on read.
  { header: 'lumper_fee', key: 'lumper_fee', alt: 'lumpter_fee' },
  { header: 'tonu', key: 'tonu' },
  { header: 'accessorials', key: 'accessorials' },
  { header: 'payment_terms', key: 'payment_terms' },
  { header: 'due_date', key: 'due_date' },
  { header: 'source_file', key: 'source_file_path' },
  { header: 'approved_at', key: 'approved_at' },
]

// Keys that live on the record itself rather than inside `details`.
const TOP_LEVEL_KEYS = new Set([
  'title',
  'due_date',
  'source_file_path',
  'approved_at',
])

function cellValue(task: Task, col: ExportColumn): string {
  const details = (task.details ?? {}) as Record<string, unknown>
  let raw: unknown = TOP_LEVEL_KEYS.has(col.key)
    ? (task as unknown as Record<string, unknown>)[col.key]
    : details[col.key]

  if ((raw === undefined || raw === null || raw === '') && col.alt) {
    raw = details[col.alt]
  }

  if (raw === undefined || raw === null || raw === '') return ''
  return String(raw)
}

// Quote only when needed — keeps plain values unquoted so the CSV stays
// readable and compatible with strict import parsers.
function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function tasksToCsv(tasks: Task[]): string {
  const header = EXPORT_COLUMNS.map((c) => csvEscape(c.header)).join(',')
  const lines = tasks.map((task) =>
    EXPORT_COLUMNS.map((c) => csvEscape(cellValue(task, c))).join(',')
  )
  // CRLF + comma is the most widely accepted CSV dialect for import tools.
  return [header, ...lines].join('\r\n')
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
