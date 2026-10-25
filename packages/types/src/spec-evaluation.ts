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
export function evaluateResult(spec: SpecLimit, r: ResultInput): ResultEvaluation {
  switch (spec.resultType) {
    case 'PASS_FAIL':
      if (r.passFail === null || r.passFail === undefined) return 'NOT_EVALUATED';
      return r.passFail ? 'WITHIN_SPEC' : 'OOS_CANDIDATE';
    case 'TEXT':
      if (spec.operator !== 'EQUALS' || !spec.expectedText) return 'NOT_EVALUATED';
      if (!r.textValue) return 'NOT_EVALUATED';
      return r.textValue.trim().toLowerCase() === spec.expectedText.trim().toLowerCase() ? 'WITHIN_SPEC' : 'OOS_CANDIDATE';
    case 'NUMERIC': {
      const v = r.numericValue;
      if (v === null || v === undefined || Number.isNaN(v)) return 'NOT_EVALUATED';
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

export function describeSpec(spec: SpecLimit): string {
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

export interface YieldResult {
  theoretical: number;
  actual: number;
  yieldPct: number;
  withinTolerance: boolean;
}

export function calculateYield(theoretical: number, actual: number, tolerance: { minPct: number; maxPct: number }): YieldResult {
  if (theoretical <= 0) throw new Error('Theoretical yield must be positive');
  const yieldPct = Math.round((actual / theoretical) * 10000) / 100;
  return { theoretical, actual, yieldPct, withinTolerance: yieldPct >= tolerance.minPct && yieldPct <= tolerance.maxPct };
}

export function variancePct(expected: number, actual: number): number {
  if (expected === 0) return actual === 0 ? 0 : 100;
  return Math.round(((actual - expected) / expected) * 10000) / 100;
}
