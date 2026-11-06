/**
 * Awards achievements from the user's own data. Runs after a session is saved and when a
 * weekly report is created. Achievements are never taken away again.
 */
import {
  addDays,
  fromUtcDate,
  isoWeekKey,
  startOfWeek,
  todayIn,
  type AchievementCode,
} from '@pace/shared';
import type { AppContext } from '../../context';
import { Prisma } from '../../generated/prisma/client';
import { loadGoals, loadSessions, loadTimezone } from '../stats/load';
import { evaluateGoals, goalsForWeek, streaks, trainingDaysPerWeek } from '../stats/metrics';
import { friendIds } from '../../policies/relationship';

const STREAK_CODES: Partial<Record<AchievementCode, number>> = {
  STREAK_3W: 3,
  STREAK_7W: 7,
  STREAK_26W: 26,
};

type Ctx = Pick<AppContext, 'prisma'>;

/** Which achievements the data supports, with a period key for repeatable ones. */
export async function earnedFromData(ctx: Ctx, userId: string) {
  const { prisma } = ctx;
  const timezone = await loadTimezone(prisma, userId);
  const today = todayIn(timezone);
  const rows = await prisma.trainingSession.findMany({
    where: { userId },
    select: { date: true, durationMinutes: true },
  });
  const { goals, sports: goalSports } = await loadGoals(prisma, userId, timezone);

  const earned: { code: AchievementCode; periodKey: string }[] = [];
  const add = (code: AchievementCode, periodKey = '') => earned.push({ code, periodKey });

  const total = rows.reduce((n, r) => n + r.durationMinutes, 0);
  if (rows.length > 0) add('FIRST_SESSION');
  if (total >= 100 * 60) add('TOTAL_100H');
  if (total >= 500 * 60) add('TOTAL_500H');

  const perWeek = new Map<string, number>();
  for (const r of rows) {
    const week = startOfWeek(fromUtcDate(r.date));
    perWeek.set(week, (perWeek.get(week) ?? 0) + r.durationMinutes);
  }
  if ([...perWeek.values()].some((m) => m >= 20 * 60)) add('WEEK_20H');

  const days = trainingDaysPerWeek(rows.map((r) => fromUtcDate(r.date)));
  const { longest } = streaks(days, goals, today);
  for (const [code, weeks] of Object.entries(STREAK_CODES)) {
    if ((longest ?? 0) >= weeks!) add(code as AchievementCode);
  }

  // All goals of a week reached: this week (as soon as it happens) and last week.
  for (const weekStart of [startOfWeek(today), addDays(startOfWeek(today), -7)]) {
    const weekGoals = goalsForWeek(goals, weekStart);
    if (!weekGoals.length) continue;
    const { sessions, sports } = await loadSessions(
      prisma,
      userId,
      weekStart,
      addDays(weekStart, 6),
    );
    const results = evaluateGoals(weekGoals, sessions, new Map([...sports, ...goalSports]));
    if (results.every((r) => r.achieved)) add('WEEKLY_GOAL', isoWeekKey(weekStart));
  }
  return earned;
}

/** Stores new achievements and sends the notifications. Returns the new codes. */
export async function awardAchievements(ctx: Ctx, userId: string): Promise<AchievementCode[]> {
  const { prisma } = ctx;
  const earned = await earnedFromData(ctx, userId);
  if (!earned.length) return [];
  const [catalogue, existing] = await Promise.all([
    prisma.achievement.findMany({ select: { id: true, code: true, threshold: true } }),
    prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, periodKey: true },
    }),
  ]);
  const byCode = new Map(catalogue.map((a) => [a.code, a]));
  const have = new Set(existing.map((e) => `${e.achievementId}|${e.periodKey}`));

  const created: AchievementCode[] = [];
  for (const { code, periodKey } of earned) {
    const achievement = byCode.get(code);
    if (!achievement || have.has(`${achievement.id}|${periodKey}`)) continue;
    try {
      await prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id, periodKey },
      });
      created.push(code);
    } catch (err) {
      // Created by a parallel request in the meantime.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    }
  }
  if (created.length) await notify(ctx, userId, created);
  return created;
}

async function notify(ctx: Ctx, userId: string, codes: AchievementCode[]) {
  const { prisma } = ctx;
  const [owner, prefs, privacy] = await Promise.all([
    prisma.userProfile.findUniqueOrThrow({
      where: { userId },
      select: { username: true, firstName: true },
    }),
    prisma.userPreferences.findUnique({ where: { userId }, select: { notifyStreaks: true } }),
    prisma.privacySettings.findUnique({
      where: { userId },
      select: { achievementsVisibility: true },
    }),
  ]);
  const data: Prisma.NotificationCreateManyInput[] = [];

  for (const code of codes) {
    const weeks = STREAK_CODES[code];
    if (weeks && prefs?.notifyStreaks !== false) {
      data.push({
        userId,
        type: 'STREAK_MILESTONE',
        payload: { key: 'streakMilestone', params: { weeks }, link: '/profile#achievements' },
      });
    }
  }

  // Friends hear about milestones (not the weekly repeatable one), only if the owner shares them.
  const milestones = codes.filter((c) => c !== 'WEEKLY_GOAL');
  if (milestones.length && privacy?.achievementsVisibility === 'FRIENDS') {
    const ids = await friendIds(prisma, userId);
    const listening = ids.length
      ? await prisma.userPreferences.findMany({
          where: { userId: { in: ids }, notifyFriendMilestones: true },
          select: { userId: true },
        })
      : [];
    for (const friend of listening) {
      for (const code of milestones) {
        data.push({
          userId: friend.userId,
          actorId: userId,
          type: 'FRIEND_ACHIEVEMENT',
          payload: {
            key: 'friendAchievement',
            params: { code, firstName: owner.firstName, username: owner.username },
            link: `/u/${owner.username}`,
          },
        });
      }
    }
  }
  if (data.length) await prisma.notification.createMany({ data });
}

/** For request handlers: the user's change is saved either way; a failure here is only logged. */
export async function tryAwardAchievements(
  ctx: Pick<AppContext, 'prisma' | 'logger'>,
  userId: string,
) {
  try {
    await awardAchievements(ctx, userId);
  } catch (err) {
    ctx.logger.error({ err, userId }, 'Awarding achievements failed');
  }
}
