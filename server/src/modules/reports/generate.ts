import { addDays, localNow, startOfWeek, todayIn, toUtcDate, type IsoDate } from '@pace/shared';
import type { AppContext } from '../../context';
import { Prisma } from '../../generated/prisma/client';
import { loadDaysPerWeek, loadGoals, loadSessions, mergeSports } from '../stats/load';
import { streaks } from '../stats/metrics';
import { withDeadlockRetry } from '../../lib/transactions';
import { buildReport } from './build';

/** Reports appear on Sunday from this hour, local time. */
export const REPORT_HOUR = 18;

/**
 * The most recent week whose report is due: this week from Sunday 18:00 local time,
 * otherwise last week (so a server that was down on Sunday evening catches up).
 */
export function dueWeekStart(timezone: string, now = new Date()): IsoDate {
  const local = localNow(timezone, now);
  const monday = startOfWeek(local.date);
  return local.weekday === 7 && local.hour >= REPORT_HOUR ? monday : addDays(monday, -7);
}

/** Creates one report. Returns false when it already existed (safe to call twice). */
export async function generateReport(
  ctx: Pick<AppContext, 'prisma'>,
  userId: string,
  weekStart: IsoDate,
  timezone: string,
): Promise<boolean> {
  const { prisma } = ctx;
  const weekEnd = addDays(weekStart, 6);
  const [period, goalData, daysPerWeek, prefs] = await Promise.all([
    loadSessions(prisma, userId, addDays(weekStart, -7), weekEnd),
    loadGoals(prisma, userId, timezone),
    loadDaysPerWeek(prisma, userId),
    prisma.userPreferences.findUnique({
      where: { userId },
      select: { notifyWeeklyReport: true, notifyGoals: true },
    }),
  ]);
  const content = buildReport({
    weekStart,
    sessions: period.sessions,
    goals: goalData.goals,
    sports: mergeSports(period.sports, goalData.sports),
    // The streak as it stood at the end of this week.
    streak: streaks(daysPerWeek, goalData.goals, weekEnd).current,
  });
  const link = `/reports/${weekStart}`;
  const { goalsAchieved, goalsTotal } = content.stats;

  try {
    await withDeadlockRetry(() =>
      prisma.$transaction(async (tx) => {
        await tx.weeklyReport.create({
          data: {
            userId,
            weekStart: toUtcDate(weekStart),
            timezone,
            stats: content.stats as unknown as Prisma.InputJsonValue,
            goalResults: content.goalResults as unknown as Prisma.InputJsonValue,
            comparison: {
              previous: content.previous,
              streak: content.streak,
            } as unknown as Prisma.InputJsonValue,
            highlights: content.highlights as unknown as Prisma.InputJsonValue,
            conclusion: content.conclusion as unknown as Prisma.InputJsonValue,
          },
        });
        if (prefs?.notifyWeeklyReport !== false) {
          await tx.notification.create({
            data: {
              userId,
              type: 'WEEKLY_REPORT',
              payload: { key: 'weeklyReport', params: { weekStart }, link },
            },
          });
        }
        if (goalsAchieved > 0 && prefs?.notifyGoals !== false) {
          await tx.notification.create({
            data: {
              userId,
              type: 'GOAL_ACHIEVED',
              payload: {
                key: 'goalsAchieved',
                params: { weekStart, achieved: goalsAchieved, total: goalsTotal },
                link,
              },
            },
          });
        }
      }),
    );
    return true;
  } catch (err) {
    // Another run created it first: UNIQUE(userId, weekStart).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
    throw err;
  }
}

/** Run by the scheduler: creates every report that is due and doesn't exist yet. */
export async function generateDueReports(ctx: AppContext, now = new Date(), batch = 200) {
  const { prisma } = ctx;
  const zones = await prisma.userProfile.groupBy({ by: ['timezone'] });
  let created = 0;
  for (const { timezone } of zones) {
    const weekStart = dueWeekStart(timezone, now);
    const weekEnd = addDays(weekStart, 6);
    const users = await prisma.user.findMany({
      where: {
        profile: { timezone },
        // Accounts created after the week can't have a report for it (rough UTC bound,
        // refined below with the local date).
        createdAt: { lt: toUtcDate(addDays(weekEnd, 2)) },
        reports: { none: { weekStart: toUtcDate(weekStart) } },
      },
      select: { id: true, createdAt: true },
      take: batch,
    });
    for (const user of users) {
      if (todayIn(timezone, user.createdAt) > weekEnd) continue;
      try {
        if (await generateReport(ctx, user.id, weekStart, timezone)) created++;
      } catch (err) {
        // One failing user must not block everyone else; the next run retries.
        ctx.logger.error({ err, userId: user.id }, 'Weekly report failed');
      }
    }
  }
  return created;
}
