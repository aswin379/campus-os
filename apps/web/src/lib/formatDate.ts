/**
 * Server timestamps come back as bare 'YYYY-MM-DD HH:MM:SS[.ffffff]' strings
 * (UTC, no timezone marker) — `new Date(...)` on that exact shape is parsed
 * as *local* time by JS engines, not UTC, so the displayed time silently
 * depends on the viewer's own browser/OS timezone instead of being
 * consistent. Always display in IST explicitly regardless of the viewer's
 * timezone, by first anchoring the string as UTC (appending 'Z') before
 * formatting it into Asia/Kolkata.
 */
export function formatIST(utcDateTime: string): string {
  let iso = utcDateTime.replace(' ', 'T');
  const dotIndex = iso.indexOf('.');
  if (dotIndex !== -1) {
    iso = iso.slice(0, dotIndex + 4); // keep only milliseconds (3 digits) — Date parsing of 6-digit fractions is unreliable
  }
  if (!iso.endsWith('Z')) iso += 'Z';
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' });
}
