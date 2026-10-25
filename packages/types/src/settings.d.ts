/** Tenant-configurable policies and thresholds (stored in Tenant.settings JSON). */
export interface TenantSettings {
    /** Received material status. Default QUARANTINE — see PRODUCT_REQUIREMENTS A4. */
    receiptDefaultStatus: 'QUARANTINE';
    yieldTolerance: {
        minPct: number;
        maxPct: number;
    };
    /** Allowed variance between expected and actual material consumption, percent. */
    consumptionVariancePct: number;
    deviationAging: {
        attentionAfterDays: number;
        overdueAfterDays: number;
    };
    deviationDueDays: {
        MINOR: number;
        MAJOR: number;
        CRITICAL: number;
    };
    capaDefaultDueDays: number;
    /** BLOCK: expired calibration prevents use in eBMR; WARN: allowed with reason. */
    calibrationPolicy: 'BLOCK' | 'WARN';
    expiryAlertDays: number[];
    qaReleaseSlaHours: number;
    numbering: Record<string, string>;
    ai: {
        enabled: boolean;
        storePrompts: boolean;
        retentionDays: number;
    };
}
export declare const DEFAULT_TENANT_SETTINGS: TenantSettings;
export declare function mergeSettings(raw: unknown): TenantSettings;
/** Format a number using a pattern such as `{PREFIX}-{YYYY}-{SEQ:6}`. */
export declare function formatNumber(pattern: string, seq: number, opts?: {
    prefix?: string;
    date?: Date;
    site?: string;
}): string;
/** Sequence scope key: the pattern with SEQ removed, so sequences reset when year/prefix change. */
export declare function sequenceScope(kind: string, pattern: string, opts?: {
    prefix?: string;
    date?: Date;
    site?: string;
}): string;
