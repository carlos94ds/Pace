import {
  addDays,
  fromUtcDate,
  isIsoDate,
  toUtcDate,
  type ReportListItem,
  type WeeklyReport,
} from '@pace/shared';
import { Router } from 'express';
import type { AppContext } from '../../context';
import { HttpError } from '../../middleware/errors';
import { currentUserId, requireAuth } from '../../middleware/session';
import type { ReportContent } from './build';

export function reportsRouter(ctx: AppContext): Router {
  const router = Router();
  const { prisma } = ctx;
  router.use(requireAuth);

  router.get('/reports', async (req, res) => {
    const rows = await prisma.weeklyReport.findMany({
      where: { userId: currentUserId(req) },
      select: { weekStart: true, generatedAt: true, viewedAt: true, stats: true },
      orderBy: { weekStart: 'desc' },
      take: 260,
    });
    const list: ReportListItem[] = rows.map((r) => {
      const stats = r.stats as unknown as ReportContent['stats'];
      return {
        weekStart: fromUtcDate(r.weekStart),
        generatedAt: r.generatedAt.toISOString(),
        viewedAt: r.viewedAt?.toISOString() ?? null,
        totalMinutes: stats.totalMinutes,
        trainingDays: stats.trainingDays,
        sessions: stats.sessions,
        goalsAchieved: stats.goalsAchieved,
        goalsTotal: stats.goalsTotal,
      };
    });
    res.json(list);
  });

  router.get('/reports/:weekStart', async (req, res) => {
    const weekStart = String(req.params.weekStart);
    if (!isIsoDate(weekStart)) throw new HttpError(404, 'not_found');
    const where = {
      userId_weekStart: { userId: currentUserId(req), weekStart: toUtcDate(weekStart) },
    };
    const row = await prisma.weeklyReport.findUnique({ where });
    if (!row) throw new HttpError(404, 'not_found');
    const viewedAt =
      row.viewedAt ??
      (await prisma.weeklyReport.update({ where, data: { viewedAt: new Date() } })).viewedAt;
    const comparison = row.comparison as unknown as Pick<ReportContent, 'previous' | 'streak'>;
    const report: WeeklyReport = {
      weekStart,
      weekEnd: addDays(weekStart, 6),
      timezone: row.timezone,
      generatedAt: row.generatedAt.toISOString(),
      viewedAt: viewedAt?.toISOString() ?? null,
      stats: row.stats as unknown as ReportContent['stats'],
      goalResults: row.goalResults as unknown as ReportContent['goalResults'],
      previous: comparison.previous,
      streak: comparison.streak,
      highlights: row.highlights as unknown as ReportContent['highlights'],
      conclusion: row.conclusion as unknown as ReportContent['conclusion'],
    };
    res.json(report);
  });

  return router;
}
