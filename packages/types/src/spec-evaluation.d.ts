import type { ResultEvaluation, SpecOperator, SpecResultType } from './statuses';
export interface SpecLimit {
    resultType: SpecResultType;
    operator: SpecOperator;
    minValue?: number | null;
    maxValue?: number | null;
    expectedText?: string | null;
    unit?: string | null;
}
export interface ResultInput {
    numericValue?: number | null;
    textValue?: string | null;
    passFail?: boolean | null;
}
/**
 * Deterministically compares a result to its specification.
 * Returns OOS_CANDIDATE only — the regulatory conclusion is always a human decision.
 */
export declare function evaluateResult(spec: SpecLimit, r: ResultInput): ResultEvaluation;
export declare function describeSpec(spec: SpecLimit): string;
export interface YieldResult {
    theoretical: number;
    actual: number;
    yieldPct: number;
    withinTolerance: boolean;
}
export declare function calculateYield(theoretical: number, actual: number, tolerance: {
    minPct: number;
    maxPct: number;
}): YieldResult;
export declare function variancePct(expected: number, actual: number): number;
