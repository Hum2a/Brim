const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/gi;

/** Title-case an address for display. Never mutate stored source data. */
export function titleCaseAddress(raw: string): string {
  const titled = raw.toLowerCase().replace(/\b([a-z])/g, (ch) => ch.toUpperCase());
  return titled.replace(POSTCODE, (_, out: string, inward: string) => `${out.toUpperCase()} ${inward.toUpperCase()}`);
}
