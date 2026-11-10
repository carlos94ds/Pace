/**
 * Pure statistics functions. They only take plain data, so the definitions in
 * docs/CHALLENGES.md (§12) are tested with fixed data, without a database.
 */
import {
  addDays,
  daysInRange,
  startOfMonth,
  addMonths,
  startOfWeek,
  type Bucket,
  type Consistency,
  type GoalResult,
  type GoalType,
  type IsoDate,
  type PeriodTotals,
  type Sport,
  type Streaks,
} from '@pace/shared';

export interface SessionFact {
  id: string;
  date: IsoDate;
  durationMinutes: number;
  punctuality: 'on_time' | 'late';
  sportId: string;
  motivation: number | null;
  rating: number;
  intensity: number | null;
  energy: number | null;
  injured: boolean;
  injuryNote: string | null;
  injuryCause: string | null;
  ratingReason: string | null;
  energyReason: string | null;
  reflection: string | null;
}

/** A goal with the local dates it was created and (if so) archived. */
export interface GoalFact {
  id: string;
  type: GoalType;
  target: number;
  sportId: string | null;
  createdOn: IsoDate;
  archivedOn: IsoDate | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
/** Average of the values that are filled in; older sessions miss some of them. */
const average = (input: (number | null)[]) => {
  const values = input.filter((v): v is number => v !== null);
  return values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;
};

export function totals(sessions: SessionFact[], sports: Map<string, Sport>): PeriodTotals {
  const totalMinutes = sessions.reduce((n, s) => n + s.durationMinutes, 0);
  const onTime = sessions.filter((s) => s.punctuality === 'on_time').length;
  const bySport = new Map<string, { sessions: number; minutes: number }>();
  for (const s of sessions) {
    const entry = bySport.get(s.sportId) ?? { sessions: 0, minutes: 0 };
    entry.sessions++;
    entry.minutes += s.durationMinutes;
    bySport.set(s.sportId, entry);
  }
  const n = sessions.length;
  return {
    sessions: n,
    trainingDays: new Set(sessions.map((s) => s.date)).size,
    totalMinutes,
    averageMinutes: n ? Math.round(totalMinutes / n) : null,
    onTime,
    late: n - onTime,
    punctualityPct: n ? Math.round((onTime / n) * 100) : null,
    averageMotivation: average(sessions.map((s) => s.motivation)),
    averageRating: average(sessions.map((s) => s.rating)),
    averageIntensity: average(sessions.map((s) => s.intensity)),
    averageEnergy: average(sessions.map((s) => s.energy)),
    injuries: sessions.filter((s) => s.injured).length,
    perSport: [...bySport.entries()]
      .map(([id, v]) => ({ sport: sports.get(id)!, ...v }))
      .sort((a, b) => b.minutes - a.minutes || b.sessions - a.sessions),
  };
}

/**
 * The goals as they stood at the end of a week: created by then and not archived by then.
 * Editing a goal archives the old version, so a past week keeps the target it had.
 */
export function goalsForWeek(goals: GoalFact[], weekStart: IsoDate): GoalFact[] {
  const weekEnd = addDays(weekStart, 6);
  return goals.filter((g) => g.createdOn <= weekEnd && (!g.archivedOn || g.archivedOn > weekEnd));
}

export function dayGoalForWeek(goals: GoalFact[], weekStart: IsoDate): number | null {
  const goal = goalsForWeek(goals, weekStart)
    .filter((g) => g.type === 'training_days')
    .sort((a, b) => (a.createdOn < b.createdOn ? 1 : -1))[0];
  return goal?.target ?? null;
}

export function evaluateGoals(
  goals: GoalFact[],
  weekSessions: SessionFact[],
  sports: Map<string, Sport>,
): GoalResult[] {
  const t = totals(weekSessions, sports);
  return goals.map((g) => {
    const actual =
      g.type === 'total_minutes'
        ? t.totalMinutes
        : g.type === 'training_days'
          ? t.trainingDays
          : g.type === 'punctuality_pct'
            ? (t.punctualityPct ?? 0)
            : weekSessions.filter((s) => s.sportId === g.sportId).length;
    // A punctuality goal needs at least one session to be measured at all.
    const achieved = actual >= g.target && (g.type !== 'punctuality_pct' || t.sessions > 0);
    return {
      type: g.type,
      target: g.target,
      sport: g.sportId ? (sports.get(g.sportId) ?? null) : null,
      actual,
      achieved,
    };
  });
}

/** Training days per week, keyed by the Monday of the week. */
export function trainingDaysPerWeek(dates: IsoDate[]): Map<IsoDate, number> {
  const days = new Map<IsoDate, Set<IsoDate>>();
  for (const date of dates) {
    const week = startOfWeek(date);
    days.set(week, (days.get(week) ?? new Set()).add(date));
  }
  return new Map([...days].map(([week, set]) => [week, set.size]));
}

/**
 * Streaks in weeks (§12): a week counts when its training days reach the day goal that
 * applied then. The running week only adds once reached, and never breaks the streak.
 */
export function streaks(
  daysPerWeek: Map<IsoDate, number>,
  goals: GoalFact[],
  today: IsoDate,
): Streaks {
  const currentWeek = startOfWeek(today);
  const dayGoal = dayGoalForWeek(goals, currentWeek);
  const firstGoal = goals
    .filter((g) => g.type === 'training_days')
    .reduce<IsoDate | null>((min, g) => (!min || g.createdOn < min ? g.createdOn : min), null);
  if (!firstGoal) return { current: null, longest: null, dayGoal: null };

  const met = (week: IsoDate) => {
    const goal = dayGoalForWeek(goals, week);
    return goal !== null && (daysPerWeek.get(week) ?? 0) >= goal;
  };

  // Weeks with sessions before the first goal can count too: a goal set on Wednesday
  // applies to that week, and earlier weeks have no goal, so they never count.
  let longest = 0;
  let run = 0;
  for (let week = startOfWeek(firstGoal); week <= currentWeek; week = addDays(week, 7)) {
    if (met(week)) longest = Math.max(longest, ++run);
    else if (week !== currentWeek) run = 0;
  }

  let current = 0;
  let week = currentWeek;
  if (!met(week)) week = addDays(week, -7);
  while (week >= startOfWeek(firstGoal) && met(week)) {
    current++;
    week = addDays(week, -7);
  }
  return { current, longest, dayGoal };
}

/**
 * Consistency (§12): share of weeks in the period that reached the day goal. The running
 * week only counts once reached. Without any day goal: training days per elapsed day.
 */
export function consistency(
  from: IsoDate,
  to: IsoDate,
  today: IsoDate,
  daysPerWeek: Map<IsoDate, number>,
  goals: GoalFact[],
  trainingDaysInRange: number,
): Consistency {
  const end = to < today ? to : today;
  if (from > end) return { pct: null, basis: 'days', achieved: 0, total: 0 };

  let achieved = 0;
  let total = 0;
  for (let week = startOfWeek(from); week <= end; week = addDays(week, 7)) {
    const goal = dayGoalForWeek(goals, week);
    if (goal === null) continue;
    const reached = (daysPerWeek.get(week) ?? 0) >= goal;
    const ended = addDays(week, 6) < today;
    if (reached || ended) {
      total++;
      if (reached) achieved++;
    }
  }
  if (total > 0)
    return { pct: Math.round((achieved / total) * 100), basis: 'weeks', achieved, total };

  const elapsed = daysInRange(from, end);
  return {
    pct: Math.round((trainingDaysInRange / elapsed) * 100),
    basis: 'days',
    achieved: trainingDaysInRange,
    total: elapsed,
  };
}

/** Days for up to a month, weeks for up to half a year, months beyond that. */
export function bucketFor(from: IsoDate, to: IsoDate): Bucket {
  const days = daysInRange(from, to);
  return days <= 31 ? 'day' : days <= 186 ? 'week' : 'month';
}

export function series(sessions: SessionFact[], from: IsoDate, to: IsoDate, bucket: Bucket) {
  const keyOf = (date: IsoDate) =>
    bucket === 'day' ? date : bucket === 'week' ? startOfWeek(date) : startOfMonth(date);
  const next = (date: IsoDate) =>
    bucket === 'day' ? addDays(date, 1) : bucket === 'week' ? addDays(date, 7) : addMonths(date, 1);

  const points = new Map<IsoDate, { start: IsoDate; minutes: number; sessions: number }>();
  for (let key = keyOf(from); key <= to; key = next(key)) {
    points.set(key, { start: key, minutes: 0, sessions: 0 });
  }
  for (const s of sessions) {
    const point = points.get(keyOf(s.date));
    if (!point) continue;
    point.minutes += s.durationMinutes;
    point.sessions++;
  }
  return [...points.values()];
}
