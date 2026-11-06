import { pipeline } from 'node:stream/promises';
import {
  addDays,
  fromUtcDate,
  startOfWeek,
  todayIn,
  toUtcDate,
  userSearchSchema,
  type GoalResult,
  type UserCard,
  type UserProfileView,
} from '@pace/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { toApi } from '../../lib/enums';
import { HttpError } from '../../middleware/errors';
import { currentUserId, requireAuth } from '../../middleware/session';
import { parseQuery } from '../../middleware/validate';
import {
  canSeeBasics,
  getRelation,
  pairKey,
  relationFromRow,
  sharedSections,
} from '../../policies/relationship';
import {
  achievementSelect,
  friendSessionSelect,
  publicUserSelect,
  reactionSummaries,
  toEarned,
  toFriendSession,
  toPublicUser,
} from '../social/mappers';
import { loadDaysPerWeek, loadGoals } from '../stats/load';
import { streaks } from '../stats/metrics';
import { sportSelect } from '../training/training.mapper';

const idSchema = z.uuid();
const usernameParam = z.string().min(1).max(30);

export function usersRouter(ctx: AppContext): Router {
  const router = Router();
  const { prisma } = ctx;
  router.use(requireAuth);

  /** Discoverable users (and people you're already connected to) by username or first name. */
  router.get('/search', async (req, res) => {
    const { q } = parseQuery(userSearchSchema, req);
    const viewerId = currentUserId(req);
    const term = q.replace(/^@/, '').toLowerCase();
    const profiles = await prisma.userProfile.findMany({
      where: {
        userId: { not: viewerId },
        OR: [{ username: { startsWith: term } }, { firstName: { contains: term } }],
        AND: {
          OR: [
            { user: { privacy: { discoverable: true } } },
            { user: { sentRequests: { some: { addresseeId: viewerId } } } },
            { user: { receivedRequests: { some: { requesterId: viewerId } } } },
          ],
        },
      },
      select: publicUserSelect,
      orderBy: { username: 'asc' },
      take: 20,
    });
    res.json(await toCards(ctx, viewerId, profiles));
  });

  router.get('/:id/avatar', async (req, res) => {
    const ownerId = idSchema.safeParse(req.params.id);
    // "Not allowed" and "doesn't exist" look the same from outside.
    if (!ownerId.success || !(await canSeeBasics(prisma, currentUserId(req), ownerId.data))) {
      throw new HttpError(404, 'not_found');
    }
    const profile = await prisma.userProfile.findUnique({
      where: { userId: ownerId.data },
      select: { avatarKey: true },
    });
    const file = profile?.avatarKey && (await ctx.storage.get(profile.avatarKey));
    if (!file) throw new HttpError(404, 'not_found');

    res.setHeader('Content-Type', file.contentType);
    // URLs are versioned per upload, so the browser may keep them; "private" keeps them out of shared caches.
    res.setHeader('Cache-Control', 'private, max-age=86400');
    await pipeline(file.body, res);
  });

  /** Another user's profile, with only the sections their privacy settings share. */
  router.get('/by-username/:username', async (req, res) => {
    const parsed = usernameParam.safeParse(req.params.username);
    if (!parsed.success) throw new HttpError(404, 'not_found');
    const viewerId = currentUserId(req);
    const owner = await prisma.userProfile.findUnique({
      where: { username: parsed.data.toLowerCase() },
      select: { ...publicUserSelect, timezone: true },
    });
    if (!owner) throw new HttpError(404, 'not_found');
    const ownerId = owner.userId;
    const { relation, requestId } = await getRelation(prisma, viewerId, ownerId);
    if (!(await canSeeBasics(prisma, viewerId, ownerId, relation)))
      throw new HttpError(404, 'not_found');

    const share = await sharedSections(prisma, relation, ownerId);
    const view: UserProfileView = {
      user: { ...toPublicUser(owner), relation, requestId },
      profile: null,
      activity: null,
      streaks: null,
      achievements: null,
      report: null,
    };

    if (share.profile) {
      const p = await prisma.userProfile.findUniqueOrThrow({
        where: { userId: ownerId },
        select: {
          bio: true,
          trainingLevel: true,
          gym: { select: { id: true, name: true, city: true } },
          user: { select: { sports: { select: { sport: { select: sportSelect } } } } },
        },
      });
      view.profile = {
        bio: p.bio,
        trainingLevel: toApi(p.trainingLevel),
        gym: p.gym,
        sports: p.user.sports.map((s) => s.sport).sort((a, b) => a.name.localeCompare(b.name)),
      };
    }

    const today = todayIn(owner.timezone);
    if (share.activity) {
      const firstWeek = addDays(startOfWeek(today), -7 * 7);
      const [byDate, recent] = await Promise.all([
        prisma.trainingSession.groupBy({
          by: ['date'],
          where: { userId: ownerId, date: { gte: toUtcDate(firstWeek) } },
          _sum: { durationMinutes: true },
        }),
        prisma.trainingSession.findMany({
          where: { userId: ownerId },
          select: friendSessionSelect,
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          take: 10,
        }),
      ]);
      const weeks = Array.from({ length: 8 }, (_, i) => ({
        weekStart: addDays(firstWeek, i * 7),
        minutes: 0,
      }));
      for (const d of byDate) {
        const week = weeks.find((w) => w.weekStart === startOfWeek(fromUtcDate(d.date)));
        if (week) week.minutes += d._sum.durationMinutes ?? 0;
      }
      const reactions = await reactionSummaries(
        prisma,
        viewerId,
        'session',
        recent.map((s) => s.id),
      );
      view.activity = {
        weeks,
        recent: recent.map((s) => ({ ...toFriendSession(s), reactions: reactions(s.id) })),
      };
    }

    if (share.streaks) {
      const [days, { goals }] = await Promise.all([
        loadDaysPerWeek(prisma, ownerId),
        loadGoals(prisma, ownerId, owner.timezone),
      ]);
      const s = streaks(days, goals, today);
      view.streaks = { current: s.current, longest: s.longest };
    }

    if (share.achievements) {
      const rows = await prisma.userAchievement.findMany({
        where: { userId: ownerId },
        select: achievementSelect,
        orderBy: { earnedAt: 'desc' },
        take: 50,
      });
      const reactions = await reactionSummaries(
        prisma,
        viewerId,
        'achievement',
        rows.map((r) => r.id),
      );
      view.achievements = rows.map((r) => toEarned(r, reactions(r.id)));
    }

    if (share.dashboard) {
      const latest = await prisma.weeklyReport.findFirst({
        where: { userId: ownerId },
        orderBy: { weekStart: 'desc' },
        select: { weekStart: true, stats: true, goalResults: true },
      });
      if (latest) {
        // Numbers and goal results only: highlights carry reflections and stay private.
        const stats = latest.stats as {
          totalMinutes: number;
          trainingDays: number;
          sessions: number;
          punctualityPct: number | null;
        };
        view.report = {
          weekStart: fromUtcDate(latest.weekStart),
          totalMinutes: stats.totalMinutes,
          trainingDays: stats.trainingDays,
          sessions: stats.sessions,
          punctualityPct: stats.punctualityPct,
          goalResults: latest.goalResults as unknown as GoalResult[],
        };
      }
    }

    res.json(view);
  });

  return router;
}

/** Adds the viewer's relationship to each user. */
export async function toCards(
  ctx: Pick<AppContext, 'prisma'>,
  viewerId: string,
  profiles: Parameters<typeof toPublicUser>[0][],
): Promise<UserCard[]> {
  const rows = profiles.length
    ? await ctx.prisma.friendship.findMany({
        where: { pairKey: { in: profiles.map((p) => pairKey(viewerId, p.userId)) } },
        select: { id: true, status: true, requesterId: true, pairKey: true },
      })
    : [];
  const byKey = new Map(rows.map((r) => [r.pairKey, r]));
  return profiles.map((p) => ({
    ...toPublicUser(p),
    ...relationFromRow(viewerId, byKey.get(pairKey(viewerId, p.userId)) ?? null),
  }));
}
