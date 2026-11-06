import {
  ACHIEVEMENT_CODES,
  reactionInputSchema,
  REACTION_TARGETS,
  REACTION_TYPES,
  type FeedItem,
  type FeedPage,
  type MyAchievements,
  type ReactionTargetType,
} from '@pace/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { Prisma } from '../../generated/prisma/client';
import { toDb } from '../../lib/enums';
import { HttpError } from '../../middleware/errors';
import { currentUserId, requireAuth } from '../../middleware/session';
import { parseBody } from '../../middleware/validate';
import { friendsSharing, getRelation, sharedSections } from '../../policies/relationship';
import {
  achievementSelect,
  friendSessionSelect,
  publicUserSelect,
  reactionSummaries,
  toEarned,
  toFriendSession,
  toPublicUser,
} from './mappers';

const PAGE = 20;

/** Cursor = createdAt and id of the last item, so items with the same timestamp aren't skipped. */
const encodeCursor = (createdAt: Date, id: string) =>
  Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
function decodeCursor(raw: unknown) {
  if (typeof raw !== 'string' || !raw) return null;
  const [iso, id] = Buffer.from(raw, 'base64url').toString().split('|');
  const date = new Date(iso ?? '');
  if (Number.isNaN(date.getTime()) || !z.uuid().safeParse(id).success) {
    throw new HttpError(400, 'validation_error', { cursor: 'invalid' });
  }
  return { date, id: id! };
}
type Cursor = { date: Date; id: string } | null;
const sessionsBefore = (c: Cursor): Prisma.TrainingSessionWhereInput =>
  c ? { OR: [{ createdAt: { lt: c.date } }, { createdAt: c.date, id: { lt: c.id } }] } : {};
const achievementsBefore = (c: Cursor): Prisma.UserAchievementWhereInput =>
  c ? { OR: [{ earnedAt: { lt: c.date } }, { earnedAt: c.date, id: { lt: c.id } }] } : {};

export function feedRouter(ctx: AppContext): Router {
  const router = Router();
  const { prisma } = ctx;
  router.use(requireAuth);

  /** Friends' sessions and achievements, newest first, for friends who share them. */
  router.get('/feed', async (req, res) => {
    const viewerId = currentUserId(req);
    const cursor = decodeCursor(req.query.cursor);
    const [activity, achievements] = await Promise.all([
      friendsSharing(prisma, viewerId, 'activity'),
      friendsSharing(prisma, viewerId, 'achievements'),
    ]);
    const [sessions, earned] = await Promise.all([
      activity.length
        ? prisma.trainingSession.findMany({
            where: { userId: { in: activity }, ...sessionsBefore(cursor) },
            select: friendSessionSelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: PAGE + 1,
          })
        : [],
      achievements.length
        ? prisma.userAchievement.findMany({
            where: { userId: { in: achievements }, ...achievementsBefore(cursor) },
            select: achievementSelect,
            orderBy: [{ earnedAt: 'desc' }, { id: 'desc' }],
            take: PAGE + 1,
          })
        : [],
    ]);

    const merged = [
      ...sessions.map((s) => ({ at: s.createdAt, id: s.id, kind: 'session' as const, s })),
      ...earned.map((a) => ({ at: a.earnedAt, id: a.id, kind: 'achievement' as const, a })),
    ]
      .sort((x, y) => y.at.getTime() - x.at.getTime() || (y.id > x.id ? 1 : -1))
      .slice(0, PAGE + 1);
    const page = merged.slice(0, PAGE);

    const userIds = [...new Set(page.map((i) => (i.kind === 'session' ? i.s.userId : i.a.userId)))];
    const users = await prisma.userProfile.findMany({
      where: { userId: { in: userIds } },
      select: publicUserSelect,
    });
    const userById = new Map(users.map((u) => [u.userId, toPublicUser(u)]));
    const [sessionReactions, achievementReactions] = await Promise.all([
      reactionSummaries(
        prisma,
        viewerId,
        'session',
        page.filter((i) => i.kind === 'session').map((i) => i.id),
      ),
      reactionSummaries(
        prisma,
        viewerId,
        'achievement',
        page.filter((i) => i.kind === 'achievement').map((i) => i.id),
      ),
    ]);

    const items: FeedItem[] = page.map((i) =>
      i.kind === 'session'
        ? {
            kind: 'session',
            user: userById.get(i.s.userId)!,
            createdAt: i.at.toISOString(),
            reactions: sessionReactions(i.id),
            ...toFriendSession(i.s),
          }
        : {
            kind: 'achievement',
            user: userById.get(i.a.userId)!,
            createdAt: i.at.toISOString(),
            ...toEarned(i.a, achievementReactions(i.id)),
          },
    );
    const last = page.at(-1);
    const result: FeedPage = {
      items,
      nextCursor: merged.length > PAGE && last ? encodeCursor(last.at, last.id) : null,
    };
    res.json(result);
  });

  /** The owner of a reaction target, if the viewer may react to it (a friend who shares it). */
  async function reactionOwner(viewerId: string, targetType: ReactionTargetType, targetId: string) {
    const owner =
      targetType === 'session'
        ? await prisma.trainingSession.findUnique({
            where: { id: targetId },
            select: { userId: true },
          })
        : await prisma.userAchievement.findUnique({
            where: { id: targetId },
            select: { userId: true },
          });
    if (!owner || owner.userId === viewerId) throw new HttpError(404, 'not_found');
    const { relation } = await getRelation(prisma, viewerId, owner.userId);
    const share = await sharedSections(prisma, relation, owner.userId);
    if (!(targetType === 'session' ? share.activity : share.achievements))
      throw new HttpError(404, 'not_found');
    return owner.userId;
  }

  router.put('/reactions', async (req, res) => {
    const viewerId = currentUserId(req);
    const { targetType, targetId, type } = parseBody(reactionInputSchema, req);
    const ownerId = await reactionOwner(viewerId, targetType, targetId);
    let created = false;
    try {
      await prisma.reaction.create({
        data: {
          fromUserId: viewerId,
          toUserId: ownerId,
          targetType: toDb(targetType),
          targetId,
          type: toDb(type),
        },
      });
      created = true;
    } catch (err) {
      // Already given: putting it again changes nothing.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    }
    if (created) {
      const prefs = await prisma.userPreferences.findUnique({
        where: { userId: ownerId },
        select: { notifyReactions: true },
      });
      if (prefs?.notifyReactions !== false) {
        const actor = await prisma.userProfile.findUniqueOrThrow({
          where: { userId: viewerId },
          select: { firstName: true, username: true },
        });
        await prisma.notification.create({
          data: {
            userId: ownerId,
            actorId: viewerId,
            type: 'REACTION',
            payload: {
              key: 'reaction',
              params: { type, targetType, firstName: actor.firstName, username: actor.username },
              link: targetType === 'session' ? '/history' : '/profile#achievements',
            },
          },
        });
      }
    }
    res.json((await reactionSummaries(prisma, viewerId, targetType, [targetId]))(targetId));
  });

  const targetParams = z.object({
    targetType: z.enum(REACTION_TARGETS),
    targetId: z.uuid(),
    type: z.enum(REACTION_TYPES),
  });

  router.delete('/reactions/:targetType/:targetId/:type', async (req: Request, res) => {
    const parsed = targetParams.safeParse(req.params);
    if (!parsed.success) throw new HttpError(404, 'not_found');
    const { targetType, targetId, type } = parsed.data;
    const viewerId = currentUserId(req);
    await prisma.reaction.deleteMany({
      where: {
        fromUserId: viewerId,
        targetType: toDb(targetType),
        targetId,
        type: toDb(type),
      },
    });
    res.json((await reactionSummaries(prisma, viewerId, targetType, [targetId]))(targetId));
  });

  /** The viewer's own achievements: the full catalogue with what has been earned. */
  router.get('/achievements', async (req, res) => {
    const viewerId = currentUserId(req);
    const rows = await prisma.userAchievement.findMany({
      where: { userId: viewerId },
      select: achievementSelect,
      orderBy: { earnedAt: 'desc' },
    });
    const reactions = await reactionSummaries(
      prisma,
      viewerId,
      'achievement',
      rows.slice(0, 20).map((r) => r.id),
    );
    const result: MyAchievements = {
      catalogue: ACHIEVEMENT_CODES.map((code) => {
        const mine = rows.filter((r) => r.achievement.code === code);
        return { code, earned: mine.length, lastEarnedAt: mine[0]?.earnedAt.toISOString() ?? null };
      }),
      recent: rows.slice(0, 20).map((r) => toEarned(r, reactions(r.id))),
    };
    res.json(result);
  });

  return router;
}
