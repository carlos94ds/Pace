import { describe, expect, it } from 'vitest';
import { timeAgo } from './text';

describe('timeAgo', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  it('picks a readable unit', () => {
    expect(timeAgo('2026-11-06T11:59:30Z', 'en', now)).toBe('30 seconds ago');
    expect(timeAgo('2026-11-06T11:55:00Z', 'en', now)).toBe('5 minutes ago');
    expect(timeAgo('2026-11-05T12:00:00Z', 'en', now)).toBe('yesterday');
    expect(timeAgo('2026-11-03T12:00:00Z', 'nl', now)).toBe('3 dagen geleden');
  });
});
