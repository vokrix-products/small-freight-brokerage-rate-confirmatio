import { TriangleAlert, CircleCheckBig, Clock } from 'lucide-react';
export const labels = [
  {
    value: 'bug',
    label: 'Bug',
  },
  {
    value: 'feature',
    label: 'Feature',
  },
  {
    value: 'documentation',
    label: 'Documentation',
  },
]

// Severity tiers drive badge color. Every status maps to exactly one tier:
//   critical -> red (destructive)   e.g. expired, denied, failed
//   warning  -> amber (warning)     e.g. expiring soon, needs review
//   good     -> green (success)     e.g. valid, approved, done
//   neutral  -> gray (secondary)    e.g. pending, queued, n/a
export type Severity = 'critical' | 'warning' | 'good' | 'neutral'

export const severityToBadgeVariant: Record<
  Severity,
  'destructive' | 'warning' | 'success' | 'secondary'
> = {
  critical: 'destructive',
  warning: 'warning',
  good: 'success',
  neutral: 'secondary',
}

// PRODUCT_CUSTOMIZE: replace this list with the real statuses this product
// produces (must match exactly what the backend poller writes to
// records.status). Every status must declare a severity tier above. Default
// values below are generic placeholders only — do not ship as-is.
// __STATUSES_BLOCK_START__
export const statuses: {
  label: string
  value: string
  icon: typeof TriangleAlert
  severity: Severity
}[] = [
  { label: 'Missing',        value: 'Missing:critical',        icon: TriangleAlert,  severity: 'critical' },
  { label: 'Low Confidence', value: 'Low Confidence:warning',  icon: Clock,          severity: 'warning' },
  { label: 'Needs Review',   value: 'Needs Review:warning',    icon: Clock,          severity: 'warning' },
  { label: 'Valid',          value: 'Valid:good',              icon: CircleCheckBig, severity: 'good' },
  { label: 'Flagged',        value: 'Flagged:critical',        icon: TriangleAlert,  severity: 'critical' },
  { label: 'Expired',        value: 'Expired:warning',         icon: Clock,          severity: 'warning' },
  { label: 'Duplicate',      value: 'Duplicate:warning',       icon: Clock,          severity: 'warning' },
  { label: 'Imported',       value: 'Imported:good',           icon: CircleCheckBig, severity: 'good' },
  { label: 'Failed',         value: 'Failed:critical',         icon: TriangleAlert,  severity: 'critical' },
];

// __STATUSES_BLOCK_END__