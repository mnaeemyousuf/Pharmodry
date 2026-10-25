/**
 * Design tokens shared between the web app and print/report views.
 * Status tones are semantic so every module renders the same status the same way.
 */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'progress' | 'muted';

export const STATUS_TONES: Record<string, Tone> = {
  // inventory
  QUARANTINE: 'warning',
  UNDER_TEST: 'info',
  RELEASED: 'success',
  REJECTED: 'danger',
  BLOCKED: 'danger',
  EXPIRED: 'danger',
  RETURNED: 'muted',
  RECALLED: 'danger',
  // batches
  PLANNED: 'neutral',
  MATERIAL_RESERVED: 'info',
  READY: 'info',
  IN_PROGRESS: 'progress',
  AWAITING_QC: 'warning',
  AWAITING_QA: 'warning',
  CLOSED: 'muted',
  CANCELLED: 'muted',
  // steps / samples
  PENDING: 'neutral',
  COMPLETED: 'success',
  VERIFIED: 'success',
  REQUESTED: 'neutral',
  COLLECTED: 'info',
  IN_TESTING: 'progress',
  SUBMITTED: 'info',
  REVIEWED: 'info',
  APPROVED: 'success',
  // quality events
  DRAFT: 'neutral',
  QA_REVIEW: 'warning',
  INVESTIGATION: 'progress',
  ROOT_CAUSE: 'progress',
  CAPA: 'progress',
  EFFECTIVENESS_CHECK: 'info',
  OPEN: 'warning',
  REPORTED: 'danger',
  PRELIMINARY_INVESTIGATION: 'progress',
  LAB_INVESTIGATION: 'progress',
  MANUFACTURING_INVESTIGATION: 'progress',
  IMPACT_ASSESSMENT: 'progress',
  QA_APPROVAL: 'warning',
  // severities & priorities
  MINOR: 'info',
  MAJOR: 'warning',
  CRITICAL: 'danger',
  LOW: 'muted',
  MEDIUM: 'info',
  HIGH: 'warning',
  // master / supplier
  ACTIVE: 'success',
  INACTIVE: 'muted',
  PENDING_QUALIFICATION: 'warning',
  CONDITIONALLY_APPROVED: 'warning',
  SUSPENDED: 'danger',
  BLACKLISTED: 'danger',
  PARTIALLY_RECEIVED: 'info',
  RECEIVED: 'success',
  // results
  PASS: 'success',
  FAIL: 'danger',
  WITHIN_SPEC: 'success',
  OOS_CANDIDATE: 'danger',
  NOT_EVALUATED: 'muted',
  CONFIRMED_OOS: 'danger',
  INVALIDATED_LAB_ERROR: 'warning',
  INVALIDATED: 'muted',
  ENTERED: 'info',
  // severity of exceptions
  INFO: 'info',
  WARNING: 'warning',
};

export function toneFor(status: string | null | undefined): Tone {
  if (!status) return 'muted';
  return STATUS_TONES[status] ?? 'neutral';
}

export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .map((w) => (w === 'qa' || w === 'qc' || w === 'oos' || w === 'capa' || w === 'api' ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}
