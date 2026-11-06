/**
 * Builds the content of a weekly report from plain data. Conclusions are fixed rules with
 * minimum-data thresholds (docs/CHALLENGES.md): nothing is said that the data doesn't show,
 * and reasons only ever come from the user's own reflections.
 */
import {
  addDays,
  type GoalResult,
  type IsoDate,
  type ReportLine,
  type ReportSession,
  type Sport,
  type WeekSummary,
  type WeeklyReport,
} from '@pace/shared';
import {
  evaluateGoals,
  goalsForWeek,
  totals,
  type GoalFact,
  type SessionFact,
} from '../stats/metrics';

export type ReportContent = Pick<
  WeeklyReport,
  'stats' | 'goalResults' | 'previous' | 'highlights' | 'conclusion' | 'streak'
>;

/** A difference smaller than this (percentage points) isn't called a change. */
const PUNCTUALITY_STEP = 10;

function summarise(
  weekStart: IsoDate,
  sessions: SessionFact[],
  goals: GoalResult[],
  sports: Map<string, Sport>,
): WeekSummary {
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const minutes = sessions
      .filter((s) => s.date === date)
      .reduce((n, s) => n + s.durationMinutes, 0);
    return { date, minutes };
  });
  return {
    weekStart,
    ...totals(sessions, sports),
    perDay,
    goalsAchieved: goals.filter((g) => g.achieved).length,
    goalsTotal: goals.length,
  };
}

const toReportSession = (s: SessionFact, sports: Map<string, Sport>): ReportSession => ({
  id: s.id,
  date: s.date,
  sport: sports.get(s.sportId)!,
  durationMinutes: s.durationMinutes,
  rating: s.rating,
  intensity: s.intensity,
  motivation: s.motivation,
  reflection: s.reflection,
});

/** Change from `before` to `now` relative to `base`, in whole percent. */
const pct = (now: number, before: number, base = before) =>
  Math.round((Math.abs(now - before) / base) * 100);
const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

export function buildReport(input: {
  weekStart: IsoDate;
  sessions: SessionFact[]; // this week and the week before
  goals: GoalFact[];
  sports: Map<string, Sport>;
  streak: number | null;
}): ReportContent {
  const { weekStart, goals, sports, streak } = input;
  const prevStart = addDays(weekStart, -7);
  const inWeek = (start: IsoDate) => (s: SessionFact) =>
    s.date >= start && s.date <= addDays(start, 6);
  const current = input.sessions.filter(inWeek(weekStart));
  const before = input.sessions.filter(inWeek(prevStart));

  const goalResults = evaluateGoals(goalsForWeek(goals, weekStart), current, sports);
  const prevGoalResults = evaluateGoals(goalsForWeek(goals, prevStart), before, sports);
  const stats = summarise(weekStart, current, goalResults, sports);
  const previous = before.length ? summarise(prevStart, before, prevGoalResults, sports) : null;

  const best = current
    .filter((s) => s.rating >= 4)
    .sort(
      (a, b) => b.rating - a.rating || b.intensity - a.intensity || a.date.localeCompare(b.date),
    )
    .slice(0, 3);
  const worst = current
    .filter((s) => s.rating <= 2)
    .sort((a, b) => a.rating - b.rating || a.date.localeCompare(b.date))
    .slice(0, 3);

  const summary: ReportLine[] = [];
  const wentWell: ReportLine[] = [];
  const improve: ReportLine[] = [];

  if (stats.sessions === 0) {
    summary.push({ key: previous ? 'noTrainingAfterActive' : 'noTraining' });
  } else {
    summary.push({
      key: 'overview',
      params: {
        sessions: stats.sessions,
        days: stats.trainingDays,
        hours: hours(stats.totalMinutes),
      },
    });
    if (!previous) summary.push({ key: 'noComparison' });
  }

  // Week-on-week comparisons need data in both weeks.
  if (previous && stats.sessions > 0) {
    const params = { now: hours(stats.totalMinutes), before: hours(previous.totalMinutes) };
    if (stats.totalMinutes > previous.totalMinutes)
      summary.push({
        key: 'hoursUp',
        params: { ...params, pct: pct(stats.totalMinutes, previous.totalMinutes) },
      });
    else if (stats.totalMinutes < previous.totalMinutes)
      summary.push({
        key: 'hoursDown',
        params: {
          ...params,
          pct: pct(previous.totalMinutes, stats.totalMinutes, previous.totalMinutes),
        },
      });
    else summary.push({ key: 'hoursSame', params });

    const days = { now: stats.trainingDays, before: previous.trainingDays };
    if (days.now > days.before) wentWell.push({ key: 'daysUp', params: days });
    if (days.now < days.before) improve.push({ key: 'daysDown', params: days });

    const p = { now: stats.punctualityPct!, before: previous.punctualityPct! };
    if (p.now - p.before >= PUNCTUALITY_STEP) wentWell.push({ key: 'punctualityUp', params: p });
    if (p.before - p.now >= PUNCTUALITY_STEP) improve.push({ key: 'punctualityDown', params: p });
  }

  if (goalResults.length === 0) {
    improve.push({ key: 'setGoals' });
  } else {
    const achieved = goalResults.filter((g) => g.achieved).length;
    const total = goalResults.length;
    if (achieved === total) wentWell.push({ key: 'allGoals', params: { total } });
    else {
      if (achieved > 0) wentWell.push({ key: 'someGoals', params: { achieved, total } });
      improve.push({ key: 'goalsMissed', params: { missed: total - achieved, total } });
    }
  }

  if (stats.sessions >= 2 && stats.late === 0)
    wentWell.push({ key: 'alwaysOnTime', params: { sessions: stats.sessions } });
  if (stats.late > 0)
    improve.push({ key: 'lateSessions', params: { late: stats.late, sessions: stats.sessions } });

  // Averages say little about one session.
  if (stats.sessions >= 2) {
    if (stats.averageRating! >= 4)
      wentWell.push({ key: 'goodRatings', params: { avg: stats.averageRating! } });
    if (stats.averageRating! <= 2.5)
      improve.push({ key: 'lowRatings', params: { avg: stats.averageRating! } });
    if (stats.averageMotivation! <= 2)
      improve.push({ key: 'lowMotivation', params: { avg: stats.averageMotivation! } });
  }

  const unexplained = worst.filter((s) => !s.reflection).length;
  if (unexplained > 0) improve.push({ key: 'noReasons', params: { count: unexplained } });

  if (streak !== null && streak >= 2) wentWell.push({ key: 'streak', params: { weeks: streak } });

  return {
    stats,
    goalResults,
    previous,
    highlights: {
      best: best.map((s) => toReportSession(s, sports)),
      worst: worst.map((s) => toReportSession(s, sports)),
    },
    conclusion: { summary, wentWell, improve },
    streak,
  };
}
