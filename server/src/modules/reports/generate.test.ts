import { addDays, startOfWeek, todayIn, toUtcDate } from '@pace/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../lib/prisma';
import { cleanupTestUsers, makeTestApp, registeredAgent } from '../../../test/helpers';
import { dueWeekStart, generateDueReports, generateReport } from './generate';

const { app, ctx } = makeTestApp();
afterAll(cleanupTestUsers);

describe('when a report is due', () => {
  it('switches to the current week on Sunday at 18:00 local time', () => {
    // Sunday 8 November 2026, Amsterdam is UTC+1.
    expect(dueWeekStart('Europe/Amsterdam', new Date('2026-11-08T16:59:00Z'))).toBe('2026-10-26');
    expect(dueWeekStart('Europe/Amsterdam', new Date('2026-11-08T17:00:00Z'))).toBe('2026-11-02');
    // At that moment it's only 12:00 in New York.
    expect(dueWeekStart('America/New_York', new Date('2026-11-08T17:00:00Z'))).toBe('2026-10-26');
    expect(dueWeekStart('America/New_York', new Date('2026-11-08T23:00:00Z'))).toBe('2026-11-02');
    // Monday morning in Tokyo is still Sunday evening in Amsterdam.
    expect(dueWeekStart('Asia/Tokyo', new Date('2026-11-08T17:00:00Z'))).toBe('2026-11-02');
  });

  it('uses local time on the days daylight saving time changes', () => {
    // 29 March 2026: clocks go forward, Amsterdam is UTC+2 from then on.
    expect(dueWeekStart('Europe/Amsterdam', new Date('2026-03-29T15:59:00Z'))).toBe('2026-03-16');
    expect(dueWeekStart('Europe/Amsterdam', new Date('2026-03-29T16:00:00Z'))).toBe('2026-03-23');
    // 25 October 2026: clocks go back, UTC+1 again.
    expect(dueWeekStart('Europe/Amsterdam', new Date('2026-10-25T16:59:00Z'))).toBe('2026-10-12');
    expect(dueWeekStart('Europe/Amsterdam', new Date('2026-10-25T17:00:00Z'))).toBe('2026-10-19');
  });
});

describe('report generation', () => {
  // UTC keeps "Sunday 18:30 local" easy to write as an instant.
  const monday = startOfWeek(todayIn('UTC'));
  const sundayEvening = new Date(`${addDays(monday, 6)}T18:30:00Z`);
  const sundayAfternoon = new Date(`${addDays(monday, 6)}T17:30:00Z`);

  async function userWithTraining(overrides = {}) {
    const { me } = await registeredAgent(app, { timezone: 'UTC', ...overrides });
    const sport = await prisma.sport.findFirstOrThrow({ where: { slug: 'mma' } });
    await prisma.trainingSession.createMany({
      data: [0, 1, 2].map((d) => ({
        userId: me.id,
        sportId: sport.id,
        date: toUtcDate(addDays(monday, d)),
        durationMinutes: 60,
        punctuality: 'ON_TIME' as const,
        motivation: 4,
        rating: 4,
        intensity: 3,
      })),
    });
    await prisma.weeklyGoal.create({
      data: { userId: me.id, type: 'TRAINING_DAYS', target: 3, createdAt: toUtcDate(monday) },
    });
    return me.id;
  }

  it('creates the report once, at Sunday 18:00, with notifications', async () => {
    const userId = await userWithTraining();
    const weekStart = toUtcDate(monday);

    await generateDueReports(ctx, sundayAfternoon);
    expect(await prisma.weeklyReport.count({ where: { userId, weekStart } })).toBe(0);

    await generateDueReports(ctx, sundayEvening);
    await generateDueReports(ctx, sundayEvening); // a second run changes nothing
    const reports = await prisma.weeklyReport.findMany({ where: { userId } });
    expect(reports).toHaveLength(1);
    expect(reports[0]!.timezone).toBe('UTC');
    expect(reports[0]!.stats).toMatchObject({
      sessions: 3,
      trainingDays: 3,
      goalsAchieved: 1,
      goalsTotal: 1,
    });
    expect(reports[0]!.comparison).toMatchObject({ streak: 1 });

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { type: 'asc' },
    });
    expect(notifications.map((x) => x.type).sort()).toEqual(['GOAL_ACHIEVED', 'WEEKLY_REPORT']);
    expect(notifications.find((x) => x.type === 'WEEKLY_REPORT')!.payload).toEqual({
      key: 'weeklyReport',
      params: { weekStart: monday },
      link: `/reports/${monday}`,
    });
    expect(await generateReport(ctx, userId, monday, 'UTC')).toBe(false);
  });

  it('respects notification preferences', async () => {
    const userId = await userWithTraining();
    await prisma.userPreferences.update({
      where: { userId },
      data: { notifyWeeklyReport: false, notifyGoals: false },
    });
    expect(await generateReport(ctx, userId, monday, 'UTC')).toBe(true);
    expect(await prisma.notification.count({ where: { userId } })).toBe(0);
  });

  it("doesn't create reports for weeks before the account existed", async () => {
    const userId = await userWithTraining();
    const lastWeekBeforeAccount = new Date(`${addDays(monday, -1)}T18:30:00Z`);
    await prisma.user.update({ where: { id: userId }, data: { createdAt: sundayAfternoon } });
    await generateDueReports(ctx, lastWeekBeforeAccount);
    expect(await prisma.weeklyReport.count({ where: { userId } })).toBe(0);
  });
});
