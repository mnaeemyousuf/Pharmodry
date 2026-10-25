"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateResult = evaluateResult;
exports.describeSpec = describeSpec;
exports.calculateYield = calculateYield;
exports.variancePct = variancePct;
/**
 * Deterministically compares a result to its specification.
 * Returns OOS_CANDIDATE only — the regulatory conclusion is always a human decision.
 */
function evaluateResult(spec, r) {
    switch (spec.resultType) {
        case 'PASS_FAIL':
            if (r.passFail === null || r.passFail === undefined)
                return 'NOT_EVALUATED';
            return r.passFail ? 'WITHIN_SPEC' : 'OOS_CANDIDATE';
        case 'TEXT':
            if (spec.operator !== 'EQUALS' || !spec.expectedText)
                return 'NOT_EVALUATED';
            if (!r.textValue)
                return 'NOT_EVALUATED';
            return r.textValue.trim().toLowerCase() === spec.expectedText.trim().toLowerCase() ? 'WITHIN_SPEC' : 'OOS_CANDIDATE';
        case 'NUMERIC': {
            const v = r.numericValue;
            if (v === null || v === undefined || Number.isNaN(v))
                return 'NOT_EVALUATED';
            const min = spec.minValue ?? null;
            const max = spec.maxValue ?? null;
            switch (spec.operator) {
                case 'RANGE':
                    return (min === null || v >= min) && (max === null || v <= max) ? 'WITHIN_SPEC' : 'OOS_CANDIDATE';
                case 'MIN':
                    return min === null || v >= min ? 'WITHIN_SPEC' : 'OOS_CANDIDATE';
                case 'MAX':
                    return max === null || v <= max ? 'WITHIN_SPEC' : 'OOS_CANDIDATE';
                case 'EQUALS':
                    return min === null || v === min ? 'WITHIN_SPEC' : 'OOS_CANDIDATE';
                default:
                    return 'NOT_EVALUATED';
            }
        }
        default:
            return 'NOT_EVALUATED';
    }
}
function describeSpec(spec) {
    const u = spec.unit ? ` ${spec.unit}` : '';
    switch (spec.operator) {
        case 'RANGE':
            return `${spec.minValue ?? '-∞'} – ${spec.maxValue ?? '∞'}${u}`;
        case 'MIN':
            return `≥ ${spec.minValue}${u}`;
        case 'MAX':
            return `≤ ${spec.maxValue}${u}`;
        case 'EQUALS':
            return spec.resultType === 'NUMERIC' ? `= ${spec.minValue}${u}` : (spec.expectedText ?? '');
        default:
            return spec.resultType === 'PASS_FAIL' ? 'Pass' : 'For information';
    }
}
function calculateYield(theoretical, actual, tolerance) {
    if (theoretical <= 0)
        throw new Error('Theoretical yield must be positive');
    const yieldPct = Math.round((actual / theoretical) * 10000) / 100;
    return { theoretical, actual, yieldPct, withinTolerance: yieldPct >= tolerance.minPct && yieldPct <= tolerance.maxPct };
}
function variancePct(expected, actual) {
    if (expected === 0)
        return actual === 0 ? 0 : 100;
    return Math.round(((actual - expected) / expected) * 10000) / 100;
}
//# sourceMappingURL=spec-evaluation.js.map