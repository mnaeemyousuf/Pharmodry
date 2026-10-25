"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TENANT_SETTINGS = void 0;
exports.mergeSettings = mergeSettings;
exports.formatNumber = formatNumber;
exports.sequenceScope = sequenceScope;
exports.DEFAULT_TENANT_SETTINGS = {
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
function mergeSettings(raw) {
    const s = (raw ?? {});
    return {
        ...exports.DEFAULT_TENANT_SETTINGS,
        ...s,
        yieldTolerance: { ...exports.DEFAULT_TENANT_SETTINGS.yieldTolerance, ...(s.yieldTolerance ?? {}) },
        deviationAging: { ...exports.DEFAULT_TENANT_SETTINGS.deviationAging, ...(s.deviationAging ?? {}) },
        deviationDueDays: { ...exports.DEFAULT_TENANT_SETTINGS.deviationDueDays, ...(s.deviationDueDays ?? {}) },
        numbering: { ...exports.DEFAULT_TENANT_SETTINGS.numbering, ...(s.numbering ?? {}) },
        ai: { ...exports.DEFAULT_TENANT_SETTINGS.ai, ...(s.ai ?? {}) },
        receiptDefaultStatus: 'QUARANTINE',
    };
}
/** Format a number using a pattern such as `{PREFIX}-{YYYY}-{SEQ:6}`. */
function formatNumber(pattern, seq, opts = {}) {
    const d = opts.date ?? new Date();
    return pattern
        .replace(/\{PREFIX\}/g, opts.prefix ?? '')
        .replace(/\{SITE\}/g, opts.site ?? '')
        .replace(/\{YYYY\}/g, String(d.getUTCFullYear()))
        .replace(/\{YY\}/g, String(d.getUTCFullYear()).slice(-2))
        .replace(/\{MM\}/g, String(d.getUTCMonth() + 1).padStart(2, '0'))
        .replace(/\{SEQ(?::(\d+))?\}/g, (_m, w) => String(seq).padStart(w ? Number(w) : 1, '0'));
}
/** Sequence scope key: the pattern with SEQ removed, so sequences reset when year/prefix change. */
function sequenceScope(kind, pattern, opts = {}) {
    return `${kind}:${formatNumber(pattern.replace(/\{SEQ(?::\d+)?\}/g, '#'), 0, opts)}`;
}
//# sourceMappingURL=settings.js.map