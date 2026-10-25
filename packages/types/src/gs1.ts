/** GS1 helpers for 2D DataMatrix data readiness (GTIN validation, element strings). */

/** GS1 mod-10 check digit for the first n-1 digits of a GTIN. */
export function gtinCheckDigit(body: string): number {
  let sum = 0;
  const digits = body.split('').reverse();
  digits.forEach((d, i) => (sum += Number(d) * (i % 2 === 0 ? 3 : 1)));
  return (10 - (sum % 10)) % 10;
}

/** Accepts GTIN-8/12/13/14; returns the normalised GTIN-14 or null when invalid. */
export function normalizeGtin(raw: string): string | null {
  const v = raw.replace(/\s/g, '');
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(v)) return null;
  const g14 = v.padStart(14, '0');
  return gtinCheckDigit(g14.slice(0, 13)) === Number(g14[13]) ? g14 : null;
}

const yymmdd = (d: Date) => `${String(d.getUTCFullYear()).slice(-2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

/**
 * Human-readable GS1 element string for a batch: (01) GTIN, (17) expiry YYMMDD, (10) batch/lot.
 * Serial numbers (21) are allocated per pack by the serialization system and are not generated here.
 */
export function gs1ElementString(gtin: string, expiry: Date, batch: string): string {
  return `(01)${gtin}(17)${yymmdd(expiry)}(10)${batch}`;
}
