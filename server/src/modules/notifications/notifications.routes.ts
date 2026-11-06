import type { AppNotification, NotificationPage, NotificationType } from '@pace/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context';
import type { PrismaClient } from '../../generated/prisma/client';
import { toApi } from '../../lib/enums';
import { HttpError } from '../../middleware/errors';
import { currentUserId, requireAuth } from '../../middleware/session';
import { parseBody } from '../../middleware/validate';
import { canSeeBasics } from '../../policies/relationship';
import { publicUserSelect, toPublicUser } from '../social/mappers';

const PAGE = 30;
/** Read notifications are removed after this many days. */
export const READ_RETENTION_DAYS = 90;

const encodeCursor = (date: Date, id: string) =>
  Buffer.from(`${date.toISOString()}|${id}`).toString('base64url');
function decodeCursor(raw: unknown) {
  if (typeof raw !== 'string' || !raw) return null;
  const [iso, id] = Buffer.from(raw, 'base64url').toString().split('|');
  const date = new Date(iso ?? '');
  if (Number.isNaN(date.getTime()) || !z.uuid().safeParse(id).success) {
    throw new HttpError(400, 'validation_error', { cursor: 'invalid' });
  }
  return { date, id: id! };
}

const readSchema = z.object({ ids: z.array(z.uuid()).max(100).optional() });

export const unreadCount = (prisma: Pick<PrismaClient, 'notification'>, userId: string) =>
  prisma.notification.count({ where: { userId, readAt: null } });

/** Removes old read notifications; run by the scheduler. */
export async function pruneNotifications(
  prisma: Pick<PrismaClient, 'notification'>,
  now = new Date(),
) {
  const cutoff = new Date(now.getTime() - READ_RETENTION_DAYS * 86_400_000);
  const { count } = await prisma.notification.deleteMany({
    where: { readAt: { not: null, lt: cutoff } },
  });
  return count;
}

export function notificationsRouter(ctx: AppContext): Router {
  const router = Router();
  const { prisma } = ctx;
  router.use(requireAuth);

  router.get('/notifications', async (req, res) => {
    const userId = currentUserId(req);
    const cursor = decodeCursor(req.query.cursor);
    const rows = await prisma.notification.findMany({
      where: {
        userId,
        ...(cursor && {
          OR: [
            { createdAt: { lt: cursor.date } },
            { createdAt: cursor.date, id: { lt: cursor.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE + 1,
    });
    const page = rows.slice(0, PAGE);

    // The person behind a notification, if the viewer may still see them at all.
    const actorIds = [...new Set(page.flatMap((n) => (n.actorId ? [n.actorId] : [])))];
    const actors = await prisma.userProfile.findMany({
      where: { userId: { in: actorIds } },
      select: publicUserSelect,
    });
    const visible = new Map<string, ReturnType<typeof toPublicUser>>();
    for (const actor of actors) {
      if (await canSeeBasics(prisma, userId, actor.userId))
        visible.set(actor.userId, toPublicUser(actor));
    }

    const items: AppNotification[] = page.map((n) => {
      const payload = n.payload as {
        key: string;
        params?: Record<string, string | number>;
        link?: string;
      };
      return {
        id: n.id,
        type: toApi<NotificationType>(n.type),
        key: payload.key,
        params: payload.params ?? {},
        link: payload.link ?? null,
        actor: n.actorId ? (visible.get(n.actorId) ?? null) : null,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      };
    });
    const last = page.at(-1);
    const result: NotificationPage = {
      items,
      nextCursor: rows.length > PAGE && last ? encodeCursor(last.createdAt, last.id) : null,
      unread: await unreadCount(prisma, userId),
    };
    res.json(result);
  });

  router.get('/notifications/unread-count', async (req, res) => {
    res.json({ unread: await unreadCount(prisma, currentUserId(req)) });
  });

  /** Marks the given notifications as read, or all of them without ids. */
  router.post('/notifications/read', async (req, res) => {
    const userId = currentUserId(req);
    const { ids } = parseBody(readSchema, req);
    await prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids && { id: { in: ids } }) },
      data: { readAt: new Date() },
    });
    res.json({ unread: await unreadCount(prisma, userId) });
  });

  return router;
}
