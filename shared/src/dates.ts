/**
 * Training dates are calendar days in the user's own timezone, written as `YYYY-MM-DD`.
 * These helpers work on those strings (via UTC midnight), so no local timezone of the
 * browser or server can shift a day.
 */
export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

export const toUtcDate = (date: IsoDate) => new Date(`${date}T00:00:00Z`);
export const fromUtcDate = (date: Date): IsoDate => date.toISOString().slice(0, 10);

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcDate(d);
}

/** Weeks start on Monday (ISO 8601). */
export function startOfWeek(date: IsoDate): IsoDate {
  const weekday = (toUtcDate(date).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date, -weekday);
}

export const startOfMonth = (date: IsoDate): IsoDate => `${date.slice(0, 7)}-01`;

export function endOfMonth(date: IsoDate): IsoDate {
  const d = toUtcDate(startOfMonth(date));
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return fromUtcDate(d);
}

export function addMonths(date: IsoDate, months: number): IsoDate {
  const d = toUtcDate(startOfMonth(date));
  d.setUTCMonth(d.getUTCMonth() + months);
  return fromUtcDate(d);
}

/** Number of calendar days from `from` to `to`, both included. */
export const daysInRange = (from: IsoDate, to: IsoDate) =>
  Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000) + 1;

/** Today's date in an IANA timezone, e.g. what "today" is for a user in Europe/Amsterdam. */
export function todayIn(timeZone: string, now = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
