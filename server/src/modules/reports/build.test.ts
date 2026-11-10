import type { Sport } from '@pace/shared';
import { describe, expect, it } from 'vitest';
import type { GoalFact, SessionFact } from '../stats/metrics';
import { buildReport } from './build';

const mma: Sport = { id: 'mma', slug: 'mma', name: 'MMA', color: '#C2413A' };
const sports = new Map([['mma', mma]]);
let n = 0;
const s = (date: string, o: Partial<SessionFact> = {}): SessionFact => ({
  id: `s${++n}`,
  date,
  durationMinutes: 60,
  punctuality: 'on_time',
  sportId: 'mma',
  motivation: 3,
  rating: 3,
  intensity: 3,
  energy: 3,
  injured: false,
  injuryNote: null,
  injuryCause: null,
  ratingReason: null,
  energyReason: null,
  reflection: null,
  ...o,
});
const goal = (o: Partial<GoalFact>): GoalFact => ({
  id: `g${++n}`,
  type: 'training_days',
  target: 3,
  sportId: null,
  createdOn: '2026-01-01',
  archivedOn: null,
  ...o,
});
const keys = (lines: { key: string }[]) => lines.map((l) => l.key);
const WEEK = '2026-11-02';

describe('weekly report', () => {
  it('compares with the previous week', () => {
    const report = buildReport({
      weekStart: WEEK,
      sessions: [
        // previous week: 2 days, 2 h, 50% on time
        s('2026-10-26'),
        s('2026-10-28', { punctuality: 'late' }),
        // this week: 3 days, 4 h, all on time
        s('2026-11-02', { durationMinutes: 90 }),
        s('2026-11-04', { durationMinutes: 90 }),
        s('2026-11-06'),
      ],
      goals: [goal({ target: 3 }), goal({ type: 'total_minutes', target: 300 })],
      sports,
      streak: 4,
    });
    expect(report.stats).toMatchObject({
      sessions: 3,
      trainingDays: 3,
      totalMinutes: 240,
      goalsAchieved: 1,
      goalsTotal: 2,
    });
    expect(report.stats.perDay.map((d) => d.minutes)).toEqual([90, 0, 90, 0, 60, 0, 0]);
    expect(report.previous).toMatchObject({
      totalMinutes: 120,
      trainingDays: 2,
      punctualityPct: 50,
    });
    expect(report.conclusion.summary).toEqual([
      { key: 'overview', params: { sessions: 3, days: 3, hours: 4 } },
      { key: 'hoursUp', params: { now: 4, before: 2, pct: 100 } },
    ]);
    expect(keys(report.conclusion.wentWell)).toEqual([
      'daysUp',
      'punctualityUp',
      'someGoals',
      'alwaysOnTime',
      'streak',
    ]);
    expect(keys(report.conclusion.improve)).toEqual(['goalsMissed']);
  });

  it('reports a decrease as a positive percentage', () => {
    const report = buildReport({
      weekStart: WEEK,
      sessions: [
        s('2026-10-26', { durationMinutes: 200 }),
        s('2026-11-03', { durationMinutes: 150 }),
      ],
      goals: [],
      sports,
      streak: null,
    });
    expect(report.conclusion.summary[1]).toEqual({
      key: 'hoursDown',
      params: { now: 2.5, before: 3.3, pct: 25 },
    });
  });

  it("doesn't compare or judge without enough data", () => {
    const report = buildReport({
      weekStart: WEEK,
      sessions: [s('2026-11-03', { rating: 1 })],
      goals: [],
      sports,
      streak: null,
    });
    expect(report.previous).toBeNull();
    expect(keys(report.conclusion.summary)).toEqual(['overview', 'noComparison']);
    // One session: no conclusions about averages; it's flagged as unexplained, not explained.
    expect(keys(report.conclusion.improve)).toEqual(['setGoals', 'noReasons']);
    expect(report.conclusion.wentWell).toEqual([]);
  });

  it('says so when there was no training', () => {
    const empty = buildReport({
      weekStart: WEEK,
      sessions: [],
      goals: [goal({})],
      sports,
      streak: 0,
    });
    expect(keys(empty.conclusion.summary)).toEqual(['noTraining']);
    expect(empty.goalResults[0]).toMatchObject({ actual: 0, achieved: false });
    const afterActive = buildReport({
      weekStart: WEEK,
      sessions: [s('2026-10-27')],
      goals: [],
      sports,
      streak: null,
    });
    expect(keys(afterActive.conclusion.summary)).toEqual(['noTrainingAfterActive']);
  });

  it("quotes only the user's own reasons for bad sessions", () => {
    const report = buildReport({
      weekStart: WEEK,
      sessions: [
        s('2026-11-02', { rating: 1, reflection: 'Slept 4 hours' }),
        s('2026-11-03', { rating: 2 }),
        s('2026-11-04', { rating: 5, intensity: 4 }),
        s('2026-11-05', { rating: 4 }),
        s('2026-11-06', { rating: 5, intensity: 5 }),
      ],
      goals: [],
      sports,
      streak: null,
    });
    expect(report.highlights.worst.map((x) => [x.date, x.reflection])).toEqual([
      ['2026-11-02', 'Slept 4 hours'],
      ['2026-11-03', null],
    ]);
    expect(report.highlights.best.map((x) => x.date)).toEqual([
      '2026-11-06',
      '2026-11-04',
      '2026-11-05',
    ]);
    expect(report.conclusion.improve).toContainEqual({ key: 'noReasons', params: { count: 1 } });
  });

  it('flags low ratings and motivation over several sessions', () => {
    const report = buildReport({
      weekStart: WEEK,
      sessions: [
        s('2026-11-02', { rating: 2, motivation: 1, punctuality: 'late', reflection: 'Tired' }),
        s('2026-11-03', { rating: 3, motivation: 2, reflection: 'Ok' }),
      ],
      goals: [goal({ target: 2 })],
      sports,
      streak: 1,
    });
    expect(keys(report.conclusion.improve)).toEqual([
      'lateSessions',
      'lowRatings',
      'lowMotivation',
    ]);
    expect(keys(report.conclusion.wentWell)).toEqual(['allGoals']);
  });

  it('flags low energy and injuries, and skips motivation that was not asked', () => {
    const report = buildReport({
      weekStart: WEEK,
      sessions: [
        s('2026-11-02', { energy: 1, motivation: null, intensity: null, injured: true }),
        s('2026-11-03', { energy: 2, motivation: null, intensity: null }),
      ],
      goals: [goal({ target: 2 })],
      sports,
      streak: 1,
    });
    expect(keys(report.conclusion.improve)).toEqual(['lowEnergy', 'injuries']);
    expect(report.conclusion.improve).toContainEqual({ key: 'injuries', params: { count: 1 } });
    expect(report.stats.averageMotivation).toBeNull();
    expect(report.stats.averageEnergy).toBe(1.5);
  });

  it('shows the reasons the user gave for rating, energy and injuries', () => {
    const report = buildReport({
      weekStart: WEEK,
      sessions: [
        s('2026-11-02', {
          rating: 1,
          ratingReason: 'Slept badly',
          energy: 1,
          energyReason: 'Tired',
        }),
        s('2026-11-03', {
          rating: 5,
          ratingReason: 'Great partner',
          energy: 5,
          injured: true,
          injuryNote: 'Left knee',
          injuryCause: 'Landed wrong',
        }),
        s('2026-11-04', { rating: 3, energy: 3 }),
      ],
      goals: [],
      sports,
      streak: null,
    });
    expect(report.highlights.worst[0]).toMatchObject({ ratingReason: 'Slept badly' });
    expect(report.highlights.best[0]).toMatchObject({ ratingReason: 'Great partner' });
    // A reason counts as an explanation, so no "give reasons" advice.
    expect(keys(report.conclusion.improve)).not.toContain('noReasons');
    expect(report.highlights.energy!.map((x) => [x.date, x.energyReason ?? null])).toEqual([
      ['2026-11-02', 'Tired'],
      ['2026-11-03', null],
    ]);
    expect(report.highlights.injuries).toEqual([
      expect.objectContaining({ injuryNote: 'Left knee', injuryCause: 'Landed wrong' }),
    ]);
  });
});
