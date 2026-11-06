import {
  addDays,
  daysInRange,
  dashboardQuerySchema,
  startOfWeek,
  todayIn,
  type Dashboard,
} from '@pace/shared';
import { Router } from 'express';
import type { AppContext } from '../../context';
import { HttpError } from '../../middleware/errors';
import { currentUserId, requireAuth } from '../../middleware/session';
import { parseQuery } from '../../middleware/validate';
import { loadDaysPerWeek, loadGoals, loadSessions, loadTimezone, mergeSports } from './load';
import {
  bucketFor,
  consistency,
  evaluateGoals,
  goalsForWeek,
  series,
  streaks,
  totals,
} from './metrics';

/** At most ~10 years per request. */
const MAX_DAYS = 3700;

export function statsRouter(ctx: AppContext): Router {
  const router = Router();
  const { prisma } = ctx;
  router.use(requireAuth);

  router.get('/stats/dashboard', async (req, res) => {
    const { from, to } = parseQuery(dashboardQuerySchema, req);
    if (daysInRange(from, to) > MAX_DAYS)
      throw new HttpError(400, 'validation_error', { from: 'too_big' });
    const userId = currentUserId(req);
    const timezone = await loadTimezone(prisma, userId);
    const today = todayIn(timezone);
    const weekStart = startOfWeek(today);

    const [period, thisWeek, goalData, daysPerWeek] = await Promise.all([
      loadSessions(prisma, userId, from, to),
      loadSessions(prisma, userId, weekStart, addDays(weekStart, 6)),
      loadGoals(prisma, userId, timezone),
      loadDaysPerWeek(prisma, userId),
    ]);
    const sports = mergeSports(period.sports, thisWeek.sports, goalData.sports);
    const periodTotals = totals(period.sessions, sports);
    const bucket = bucketFor(from, to);

    const dashboard: Dashboard = {
      from,
      to,
      totals: periodTotals,
      consistency: consistency(
        from,
        to,
        today,
        daysPerWeek,
        goalData.goals,
        periodTotals.trainingDays,
      ),
      streaks: streaks(daysPerWeek, goalData.goals, today),
      bucket,
      series: series(period.sessions, from, to, bucket),
      goals: {
        weekStart,
        results: evaluateGoals(goalsForWeek(goalData.goals, weekStart), thisWeek.sessions, sports),
      },
    };
    res.json(dashboard);
  });

  return router;
}
