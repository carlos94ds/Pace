import { toUtcDate } from '@pace/shared';

/** 95 → "1:35 h", 45 → "45 min". */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')} h`;
}

/** Hours with one decimal for totals, e.g. 7.5. */
export const toHours = (minutes: number, locale: string) =>
  (minutes / 60).toLocaleString(locale, { maximumFractionDigits: 1 });

/** Formats a `YYYY-MM-DD` day without the browser's timezone shifting it. */
export function formatDay(date: string, locale: string, options: Intl.DateTimeFormatOptions) {
  return toUtcDate(date).toLocaleDateString(locale, { ...options, timeZone: 'UTC' });
}
