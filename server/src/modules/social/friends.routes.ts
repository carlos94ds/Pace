import {
  addDays,
  friendRequestSchema,
  startOfWeek,
  todayIn,
  toUtcDate,
  type FriendRequests,
  type Suggestion,
  type UserCard,
} from '@pace/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { Prisma } from '../../generated/prisma/client';
import { HttpError } from '../../middleware/errors';
import { currentUserId, requireAuth } from '../../middleware/session';
import { parseBody } from '../../middleware/validate';
import { canSeeBasics, friendIds, getRelation, pairKey } from '../../policies/relationship';
import { publicUserSelect, toPublicUser } from './mappers';

/** Open requests one user may have sent, against spam. */
const MAX_OUTGOING = 50;

const idParam = (req: Request, key = 'id') => {
  const parsed = z.uuid().safeParse(req.params[key]);
  if (!parsed.success) throw new HttpError(404, 'not_found');
  return parsed.data;
};

export function friendsRouter(ctx: AppContext): Router {
  const router = Router();
  const { prisma } = ctx;
  router.use(requireAuth);

  async function profileOf(userId: string) {
    return prisma.userProfile.findUniqueOrThrow({ where: { userId }, select: publicUserSelect });
  }

  async function notify(
    userId: string,
    actorId: string,
    type: 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED',
    pref: 'notifyFriendRequests' | 'notifyFriendAccepted',
  ) {
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId },
      select: { [pref]: true },
    });
    if (prefs && (prefs as Record<string, boolean>)[pref] === false) return;
    const actor = await profileOf(actorId);
    await prisma.notification.create({
      data: {
        userId,
        actorId,
        type,
        payload: {
          key: type === 'FRIEND_REQUEST' ? 'friendRequest' : 'friendAccepted',
          params: { firstName: actor.firstName, username: actor.username },
          link: type === 'FRIEND_REQUEST' ? '/friends?tab=requests' : `/u/${actor.username}`,
        },
      },
    });
  }

  /** Accepted friends, with their training hours this week when they share their activity. */
  router.get('/friends', async (req, res) => {
    const viewerId = currentUserId(req);
    const ids = await friendIds(prisma, viewerId);
    const profiles = await prisma.userProfile.findMany({
      where: { userId: { in: ids } },
      select: {
        ...publicUserSelect,
        timezone: true,
        user: { select: { privacy: { select: { activityVisibility: true } } } },
      },
      orderBy: { firstName: 'asc' },
    });
    const sharing = profiles.filter((p) => p.user.privacy?.activityVisibility === 'FRIENDS');
    const minutes = new Map<string, number>();
    await Promise.all(
      sharing.map(async (p) => {
        const monday = startOfWeek(todayIn(p.timezone));
        const sum = await prisma.trainingSession.aggregate({
          where: {
            userId: p.userId,
            date: { gte: toUtcDate(monday), lte: toUtcDate(addDays(monday, 6)) },
          },
          _sum: { durationMinutes: true },
        });
        minutes.set(p.userId, sum._sum.durationMinutes ?? 0);
      }),
    );
    res.json(
      profiles.map((p) => ({
        ...toPublicUser(p),
        relation: 'friends',
        requestId: null,
        weekMinutes: minutes.get(p.userId) ?? null,
      })),
    );
  });

  router.get('/friends/requests', async (req, res) => {
    const viewerId = currentUserId(req);
    const rows = await prisma.friendship.findMany({
      where: {
        OR: [
          { addresseeId: viewerId, status: 'PENDING' },
          // Declined requests keep looking pending to their sender.
          { requesterId: viewerId, status: { in: ['PENDING', 'DECLINED'] } },
        ],
      },
      select: {
        id: true,
        requesterId: true,
        createdAt: true,
        requester: { select: { profile: { select: publicUserSelect } } },
        addressee: { select: { profile: { select: publicUserSelect } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const result: FriendRequests = { incoming: [], outgoing: [] };
    for (const r of rows) {
      const incoming = r.requesterId !== viewerId;
      const other = (incoming ? r.requester : r.addressee).profile!;
      result[incoming ? 'incoming' : 'outgoing'].push({
        ...toPublicUser(other),
        relation: incoming ? 'incoming' : 'outgoing',
        requestId: r.id,
        sentAt: r.createdAt.toISOString(),
      });
    }
    res.json(result);
  });

  /**
   * People you may know: discoverable users who aren't connected to you yet, ranked by
   * mutual friends, the same gym and shared sports. Only mutual friends are shown as a
   * reason, so a stranger's gym or sports are never revealed.
   */
  router.get('/friends/suggestions', async (req, res) => {
    const viewerId = currentUserId(req);
    const [mine, me] = await Promise.all([
      friendIds(prisma, viewerId),
      prisma.userProfile.findUniqueOrThrow({
        where: { userId: viewerId },
        select: { gymId: true, user: { select: { sports: { select: { sportId: true } } } } },
      }),
    ]);
    const connected = await prisma.friendship.findMany({
      where: { OR: [{ requesterId: viewerId }, { addresseeId: viewerId }] },
      select: { requesterId: true, addresseeId: true },
    });
    const exclude = new Set([
      viewerId,
      ...connected.flatMap((c) => [c.requesterId, c.addresseeId]),
    ]);

    const score = new Map<string, { score: number; mutual: number }>();
    const bump = (id: string, points: number, mutual = 0) => {
      if (exclude.has(id)) return;
      const s = score.get(id) ?? { score: 0, mutual: 0 };
      s.score += points;
      s.mutual += mutual;
      score.set(id, s);
    };
    if (mine.length) {
      const ofFriends = await prisma.friendship.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ requesterId: { in: mine } }, { addresseeId: { in: mine } }],
        },
        select: { requesterId: true, addresseeId: true },
      });
      const mineSet = new Set(mine);
      for (const f of ofFriends) {
        if (mineSet.has(f.requesterId)) bump(f.addresseeId, 3, 1);
        if (mineSet.has(f.addresseeId)) bump(f.requesterId, 3, 1);
      }
    }
    if (me.gymId) {
      const sameGym = await prisma.userProfile.findMany({
        where: { gymId: me.gymId },
        select: { userId: true },
        take: 200,
      });
      for (const p of sameGym) bump(p.userId, 2);
    }
    const sportIds = me.user.sports.map((s) => s.sportId);
    if (sportIds.length) {
      const sameSport = await prisma.userSport.findMany({
        where: { sportId: { in: sportIds } },
        select: { userId: true },
        take: 1000,
      });
      for (const s of sameSport) bump(s.userId, 1);
    }

    const ranked = [...score.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, 50);
    const profiles = await prisma.userProfile.findMany({
      where: {
        userId: { in: ranked.map(([id]) => id) },
        user: { privacy: { discoverable: true } },
      },
      select: publicUserSelect,
    });
    const byId = new Map(profiles.map((p) => [p.userId, p]));
    const suggestions: Suggestion[] = ranked
      .filter(([id]) => byId.has(id))
      .slice(0, 10)
      .map(([id, s]) => ({
        ...toPublicUser(byId.get(id)!),
        relation: 'none',
        requestId: null,
        mutualFriends: s.mutual,
      }));
    res.json(suggestions);
  });

  router.post('/friends/requests', async (req, res) => {
    const viewerId = currentUserId(req);
    const { userId } = parseBody(friendRequestSchema, req);
    if (userId === viewerId) throw new HttpError(400, 'validation_error', { userId: 'self' });
    const exists = await prisma.userProfile.count({ where: { userId } });
    if (!exists || !(await canSeeBasics(prisma, viewerId, userId)))
      throw new HttpError(404, 'not_found');

    const key = pairKey(viewerId, userId);
    const row = await prisma.friendship.findUnique({ where: { pairKey: key } });
    const card = async (): Promise<UserCard> => {
      const rel = await getRelation(prisma, viewerId, userId);
      return { ...toPublicUser(await profileOf(userId)), ...rel };
    };

    if (row?.status === 'ACCEPTED') throw new HttpError(409, 'already_friends');
    if (row && row.requesterId === viewerId) {
      // Already sent (and maybe declined, which the sender doesn't see).
      res.json(await card());
      return;
    }
    if (row && row.status === 'PENDING') {
      // They asked first: sending a request back means yes.
      await prisma.friendship.update({
        where: { id: row.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      await notify(userId, viewerId, 'FRIEND_ACCEPTED', 'notifyFriendAccepted');
      res.json(await card());
      return;
    }
    const outgoing = await prisma.friendship.count({
      where: { requesterId: viewerId, status: { in: ['PENDING', 'DECLINED'] } },
    });
    if (outgoing >= MAX_OUTGOING) throw new HttpError(409, 'limit_reached');
    try {
      if (row) {
        // The viewer once declined this person; now the viewer asks.
        await prisma.friendship.update({
          where: { id: row.id },
          data: {
            requesterId: viewerId,
            addresseeId: userId,
            status: 'PENDING',
            createdAt: new Date(),
            respondedAt: null,
          },
        });
      } else {
        await prisma.friendship.create({
          data: { requesterId: viewerId, addresseeId: userId, pairKey: key },
        });
      }
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    }
    await notify(userId, viewerId, 'FRIEND_REQUEST', 'notifyFriendRequests');
    res.status(201).json(await card());
  });

  async function respond(req: Request, accept: boolean) {
    const viewerId = currentUserId(req);
    const { count } = await prisma.friendship.updateMany({
      where: { id: idParam(req), addresseeId: viewerId, status: 'PENDING' },
      data: { status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
    });
    if (!count) throw new HttpError(404, 'not_found');
    return viewerId;
  }

  router.post('/friends/requests/:id/accept', async (req, res) => {
    const viewerId = await respond(req, true);
    const row = await prisma.friendship.findUniqueOrThrow({
      where: { id: idParam(req) },
      select: { requesterId: true },
    });
    await notify(row.requesterId, viewerId, 'FRIEND_ACCEPTED', 'notifyFriendAccepted');
    res.status(204).end();
  });

  router.post('/friends/requests/:id/decline', async (req, res) => {
    await respond(req, false);
    res.status(204).end();
  });

  /** The sender withdraws a request. */
  router.delete('/friends/requests/:id', async (req, res) => {
    const viewerId = currentUserId(req);
    const id = idParam(req);
    const row = await prisma.friendship.findFirst({
      where: { id, requesterId: viewerId, status: { in: ['PENDING', 'DECLINED'] } },
      select: { addresseeId: true },
    });
    if (!row) throw new HttpError(404, 'not_found');
    await prisma.friendship.delete({ where: { id } });
    // The request notification is no longer relevant.
    await prisma.notification.deleteMany({
      where: { userId: row.addresseeId, actorId: viewerId, type: 'FRIEND_REQUEST' },
    });
    res.status(204).end();
  });

  router.delete('/friends/:userId', async (req, res) => {
    const viewerId = currentUserId(req);
    const { count } = await prisma.friendship.deleteMany({
      where: { pairKey: pairKey(viewerId, idParam(req, 'userId')), status: 'ACCEPTED' },
    });
    if (!count) throw new HttpError(404, 'not_found');
    res.status(204).end();
  });

  return router;
}
