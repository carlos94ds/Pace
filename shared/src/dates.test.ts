import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysInRange,
  endOfMonth,
  isIsoDate,
  isoWeekKey,
  startOfWeek,
  todayIn,
} from './dates';

describe('dates', () => {
  it('validates real calendar days only', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('26-1-1')).toBe(false);
  });

  it('starts weeks on Monday, also across DST and year ends', () => {
    expect(startOfWeek('2026-11-06')).toBe('2026-11-02'); // Friday
    expect(startOfWeek('2026-11-02')).toBe('2026-11-02'); // Monday
    expect(startOfWeek('2026-11-08')).toBe('2026-11-02'); // Sunday
    expect(startOfWeek('2026-03-29')).toBe('2026-03-23'); // DST change in Europe
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28');
  });

  it('does month arithmetic', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(daysInRange('2026-11-02', '2026-11-08')).toBe(7);
  });

  it("gives today's date in the user's timezone", () => {
    const now = new Date('2026-11-06T23:30:00Z');
    expect(todayIn('Europe/Amsterdam', now)).toBe('2026-11-07');
    expect(todayIn('America/New_York', now)).toBe('2026-11-06');
  });
});

describe('isoWeekKey', () => {
  it('numbers weeks like ISO 8601', () => {
    expect(isoWeekKey('2026-11-06')).toBe('2026-W45');
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01');
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
    expect(isoWeekKey('2024-12-30')).toBe('2025-W01');
  });
});
