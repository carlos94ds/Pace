import { describe, expect, it } from 'vitest';
import { formatDay, formatDuration, toHours } from './format';

describe('format', () => {
  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1:00 h');
    expect(formatDuration(95)).toBe('1:35 h');
  });

  it('formats hours and days without timezone shifts', () => {
    expect(toHours(450, 'en')).toBe('7.5');
    expect(toHours(450, 'nl')).toBe('7,5');
    expect(formatDay('2026-11-02', 'en', { weekday: 'long' })).toBe('Monday');
  });
});
