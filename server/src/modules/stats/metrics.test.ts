import type { Sport } from '@pace/shared';
import { describe, expect, it } from 'vitest';
import {
  bucketFor,
  consistency,
  evaluateGoals,
  goalsForWeek,
  series,
  streaks,
  totals,
  trainingDaysPerWeek,
  type GoalFact,
  type SessionFact,
} from './metrics';

const mma: Sport = { id: 'mma', slug: 'mma', name: 'MMA', color: '#C2413A' };
const bjj: Sport = { id: 'bjj', slug: 'bjj', name: 'BJJ', color: '#3E63B8' };
const sports = new Map([
  ['mma', mma],
  ['bjj', bjj],
]);

let n = 0;
const s = (date: string, overrides: Partial<SessionFact> = {}): SessionFact => ({
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
  ...overrides,
});
const goal = (overrides: Partial<GoalFact>): GoalFact => ({
  id: `g${++n}`,
  type: 'training_days',
  target: 3,
  sportId: null,
  createdOn: '2026-01-01',
  archivedOn: null,
  ...overrides,
});

/** Sessions on the given weekdays (0 = Monday) of the week starting `monday`. */
const week = (monday: string, weekdays: number[]) =>
  weekdays.map((d) => s(new Date(Date.parse(monday) + d * 86_400_000).toISOString().slice(0, 10)));

describe('totals', () => {
  it('counts days, sessions, averages and punctuality', () => {
    const t = totals(
      [
        s('2026-11-02', { durationMinutes: 90, rating: 5, motivation: 4, intensity: 4 }),
        s('2026-11-02', { durationMinutes: 30, sportId: 'bjj', punctuality: 'late', rating: 2 }),
        s('2026-11-04', { durationMinutes: 45, rating: 4 }),
      ],
      sports,
    );
    expect(t).toMatchObject({
      sessions: 3,
      trainingDays: 2,
      totalMinutes: 165,
      averageMinutes: 55,
      onTime: 2,
      late: 1,
      punctualityPct: 67,
      averageRating: 3.7,
      averageMotivation: 3.3,
    });
    expect(t.perSport.map((p) => [p.sport.id, p.minutes, p.sessions])).toEqual([
      ['mma', 135, 2],
      ['bjj', 30, 1],
    ]);
  });

  it('has no averages without sessions', () => {
    expect(totals([], sports)).toMatchObject({
      sessions: 0,
      averageMinutes: null,
      punctualityPct: null,
      averageRating: null,
    });
  });
});

describe('goals', () => {
  const weekSessions = [
    s('2026-11-02', { durationMinutes: 120 }),
    s('2026-11-03', { durationMinutes: 90, sportId: 'bjj', punctuality: 'late' }),
    s('2026-11-05', { durationMinutes: 60 }),
    s('2026-11-05', { durationMinutes: 60 }),
  ];

  it('evaluates every goal type', () => {
    const results = evaluateGoals(
      [
        goal({ type: 'total_minutes', target: 300 }),
        goal({ type: 'training_days', target: 5 }),
        goal({ type: 'punctuality_pct', target: 75 }),
        goal({ type: 'sport_sessions', target: 3, sportId: 'mma' }),
        goal({ type: 'sport_sessions', target: 2, sportId: 'bjj' }),
      ],
      weekSessions,
      sports,
    );
    expect(results.map((r) => [r.type, r.actual, r.achieved])).toEqual([
      ['total_minutes', 330, true],
      ['training_days', 3, false],
      ['punctuality_pct', 75, true],
      ['sport_sessions', 3, true],
      ['sport_sessions', 1, false],
    ]);
    expect(results[3]!.sport).toEqual(mma);
  });

  it("doesn't count a punctuality goal as reached without sessions", () => {
    const [result] = evaluateGoals([goal({ type: 'punctuality_pct', target: 1 })], [], sports);
    expect(result!.achieved).toBe(false);
  });

  it('uses the goals as they stood at the end of each week', () => {
    const old = goal({ target: 3, createdOn: '2026-10-01', archivedOn: '2026-11-04' });
    const edited = goal({ target: 5, createdOn: '2026-11-04' });
    const deleted = goal({
      type: 'total_minutes',
      createdOn: '2026-10-01',
      archivedOn: '2026-10-20',
    });
    const goals = [old, edited, deleted];
    expect(goalsForWeek(goals, '2026-10-26').map((g) => g.id)).toEqual([old.id]);
    expect(goalsForWeek(goals, '2026-11-02').map((g) => g.id)).toEqual([edited.id]);
    expect(goalsForWeek(goals, '2026-10-12').map((g) => g.id)).toEqual([old.id, deleted.id]);
    expect(goalsForWeek(goals, '2026-09-21')).toEqual([]);
  });
});

describe('streaks (weeks reaching the day goal)', () => {
  const fiveDays = goal({ target: 5, createdOn: '2026-09-01' });

  it('counts consecutive weeks and resets on a week below the goal', () => {
    const sessions = [
      ...week('2026-09-07', [0, 1, 2, 3, 4]), // met
      ...week('2026-09-14', [0, 1, 2, 3]), // 4 days: breaks
      ...week('2026-09-21', [0, 1, 2, 3, 4, 5]), // met
      ...week('2026-09-28', [0, 1, 2, 3, 4]), // met
      ...week('2026-10-05', [0, 1, 2, 3, 6]), // met (Sunday counts)
    ];
    const days = trainingDaysPerWeek(sessions.map((x) => x.date));
    // Wednesday of the following week, goal not reached yet: the streak is still alive.
    expect(streaks(days, [fiveDays], '2026-10-14')).toEqual({ current: 3, longest: 3, dayGoal: 5 });
    // A week later, that week ended below the goal: back to 0.
    expect(streaks(days, [fiveDays], '2026-10-21')).toEqual({ current: 0, longest: 3, dayGoal: 5 });
  });

  it('adds the running week as soon as the goal is reached', () => {
    const sessions = [...week('2026-10-05', [0, 1, 2]), ...week('2026-10-12', [0, 1, 2])];
    const days = trainingDaysPerWeek(sessions.map((x) => x.date));
    const three = goal({ target: 3, createdOn: '2026-10-01' });
    expect(streaks(days, [three], '2026-10-14')).toMatchObject({ current: 2, longest: 2 });
  });

  it('counts two sessions on one day as one training day', () => {
    const sessions = [s('2026-10-05'), s('2026-10-05'), s('2026-10-06'), s('2026-10-06')];
    const days = trainingDaysPerWeek(sessions.map((x) => x.date));
    const three = goal({ target: 3, createdOn: '2026-10-01' });
    expect(streaks(days, [three], '2026-10-20')).toMatchObject({ current: 0, longest: 0 });
  });

  it('has no streak without a day goal', () => {
    const days = trainingDaysPerWeek(week('2026-10-05', [0, 1, 2, 3, 4]).map((x) => x.date));
    expect(streaks(days, [], '2026-10-08')).toEqual({
      current: null,
      longest: null,
      dayGoal: null,
    });
  });

  it('applies the target that was valid in each week', () => {
    const sessions = [...week('2026-09-28', [0, 1, 2]), ...week('2026-10-05', [0, 1, 2])];
    const days = trainingDaysPerWeek(sessions.map((x) => x.date));
    const goals = [
      goal({ target: 3, createdOn: '2026-09-01', archivedOn: '2026-10-06' }),
      goal({ target: 5, createdOn: '2026-10-06' }),
    ];
    // Week of 28 Sep: 3 of 3 → counts. Week of 5 Oct: 3 of 5 → breaks once it has ended.
    expect(streaks(days, goals, '2026-10-13')).toMatchObject({
      current: 0,
      longest: 1,
      dayGoal: 5,
    });
  });

  it('works across the end of daylight saving time and the year', () => {
    const sessions = [
      ...week('2026-10-19', [0, 1, 2]),
      ...week('2026-10-26', [0, 1, 2]), // DST ends on Sunday 25 October in Europe
      ...week('2026-12-28', [0, 1, 2]),
      ...week('2027-01-04', [0, 1, 2]),
    ];
    const days = trainingDaysPerWeek(sessions.map((x) => x.date));
    expect(days.get('2026-10-26')).toBe(3);
    expect(days.get('2026-12-28')).toBe(3);
    const three = goal({ target: 3, createdOn: '2026-10-01' });
    expect(streaks(days, [three], '2027-01-06')).toMatchObject({ current: 2, longest: 2 });
  });
});

describe('consistency', () => {
  const three = goal({ target: 3, createdOn: '2026-09-01' });
  const sessions = [
    ...week('2026-10-05', [0, 1, 2]), // met
    ...week('2026-10-12', [0]), // missed
    ...week('2026-10-19', [0, 1, 2, 3]), // met
    ...week('2026-10-26', [0]), // running week, not met yet
  ];
  const days = trainingDaysPerWeek(sessions.map((x) => x.date));

  it('is the share of weeks reaching the day goal, ignoring an unfinished week', () => {
    expect(consistency('2026-10-05', '2026-11-01', '2026-10-27', days, [three], 9)).toEqual({
      pct: 67,
      basis: 'weeks',
      achieved: 2,
      total: 3,
    });
  });

  it('falls back to training days per elapsed day without a day goal', () => {
    expect(consistency('2026-10-05', '2026-10-31', '2026-10-14', days, [], 4)).toEqual({
      pct: 40,
      basis: 'days',
      achieved: 4,
      total: 10,
    });
  });

  it('is empty for a period in the future', () => {
    expect(consistency('2027-01-01', '2027-01-31', '2026-10-14', days, [three], 0).pct).toBeNull();
  });
});

describe('series', () => {
  it('picks a bucket size for the period', () => {
    expect(bucketFor('2026-11-02', '2026-11-08')).toBe('day');
    expect(bucketFor('2026-10-01', '2026-10-31')).toBe('day');
    expect(bucketFor('2026-07-01', '2026-10-31')).toBe('week');
    expect(bucketFor('2026-01-01', '2026-12-31')).toBe('month');
  });

  it('fills empty buckets with zero', () => {
    const points = series(
      [s('2026-11-03', { durationMinutes: 50 }), s('2026-11-03'), s('2026-11-08')],
      '2026-11-02',
      '2026-11-08',
      'day',
    );
    expect(points).toHaveLength(7);
    expect(points[1]).toEqual({ start: '2026-11-03', minutes: 110, sessions: 2 });
    expect(points[0]!.minutes).toBe(0);
    const months = series([s('2026-03-15')], '2026-01-01', '2026-12-31', 'month');
    expect(months.map((p) => p.start)).toHaveLength(12);
    expect(months[2]).toMatchObject({ start: '2026-03-01', sessions: 1 });
  });
});
