/** Tenant-configurable policies and thresholds (stored in Tenant.settings JSON). */
export interface TenantSettings {
  /** Received material status. Default QUARANTINE — see PRODUCT_REQUIREMENTS A4. */
  receiptDefaultStatus: 'QUARANTINE';
  yieldTolerance: { minPct: number; maxPct: number };
  /** Allowed variance between expected and actual material consumption, percent. */
  consumptionVariancePct: number;
  deviationAging: { attentionAfterDays: number; overdueAfterDays: number };
  deviationDueDays: { MINOR: number; MAJOR: number; CRITICAL: number };
  capaDefaultDueDays: number;
  /** BLOCK: expired calibration prevents use in eBMR; WARN: allowed with reason. */
  calibrationPolicy: 'BLOCK' | 'WARN';
  expiryAlertDays: number[];
  qaReleaseSlaHours: number;
  numbering: Record<string, string>;
  ai: { enabled: boolean; storePrompts: boolean; retentionDays: number };
}

export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  receiptDefaultStatus: 'QUARANTINE',
  yieldTolerance: { minPct: 98, maxPct: 102 },
  consumptionVariancePct: 2,
  deviationAging: { attentionAfterDays: 15, overdueAfterDays: 30 },
  deviationDueDays: { MINOR: 30, MAJOR: 30, CRITICAL: 15 },
  capaDefaultDueDays: 60,
  calibrationPolicy: 'BLOCK',
  expiryAlertDays: [30, 60, 90],
  qaReleaseSlaHours: 48,
  numbering: {
    BATCH: '{PREFIX}-{YYYY}-{SEQ:6}',
    GRN: 'GRN-{YYYY}-{SEQ:5}',
    LOT: '{PREFIX}{YY}-{SEQ:5}',
    PO: 'PO-{YYYY}-{SEQ:5}',
    QC_SAMPLE: 'QCS-{YYYY}-{SEQ:5}',
    DEVIATION: 'DEV-{YYYY}-{SEQ:4}',
    CAPA: 'CAPA-{YYYY}-{SEQ:4}',
    OOS: 'OOS-{YYYY}-{SEQ:4}',
    PLAN: 'PP-{YYYY}-{SEQ:4}',
  },
  ai: { enabled: true, storePrompts: true, retentionDays: 180 },
};

export function mergeSettings(raw: unknown): TenantSettings {
  const s = (raw ?? {}) as Partial<TenantSettings>;
  return {
    ...DEFAULT_TENANT_SETTINGS,
    ...s,
    yieldTolerance: { ...DEFAULT_TENANT_SETTINGS.yieldTolerance, ...(s.yieldTolerance ?? {}) },
    deviationAging: { ...DEFAULT_TENANT_SETTINGS.deviationAging, ...(s.deviationAging ?? {}) },
    deviationDueDays: { ...DEFAULT_TENANT_SETTINGS.deviationDueDays, ...(s.deviationDueDays ?? {}) },
    numbering: { ...DEFAULT_TENANT_SETTINGS.numbering, ...(s.numbering ?? {}) },
    ai: { ...DEFAULT_TENANT_SETTINGS.ai, ...(s.ai ?? {}) },
    receiptDefaultStatus: 'QUARANTINE',
  };
}

/** Format a number using a pattern such as `{PREFIX}-{YYYY}-{SEQ:6}`. */
export function formatNumber(pattern: string, seq: number, opts: { prefix?: string; date?: Date; site?: string } = {}): string {
  const d = opts.date ?? new Date();
  return pattern
    .replace(/\{PREFIX\}/g, opts.prefix ?? '')
    .replace(/\{SITE\}/g, opts.site ?? '')
    .replace(/\{YYYY\}/g, String(d.getUTCFullYear()))
    .replace(/\{YY\}/g, String(d.getUTCFullYear()).slice(-2))
    .replace(/\{MM\}/g, String(d.getUTCMonth() + 1).padStart(2, '0'))
    .replace(/\{SEQ(?::(\d+))?\}/g, (_m, w: string | undefined) => String(seq).padStart(w ? Number(w) : 1, '0'));
}

/** Sequence scope key: the pattern with SEQ removed, so sequences reset when year/prefix change. */
export function sequenceScope(kind: string, pattern: string, opts: { prefix?: string; date?: Date; site?: string } = {}): string {
  return `${kind}:${formatNumber(pattern.replace(/\{SEQ(?::\d+)?\}/g, '#'), 0, opts)}`;
}
