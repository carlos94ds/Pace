import { pipeline } from 'node:stream/promises';
import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { HttpError } from '../../middleware/errors';
import { currentUserId, requireAuth } from '../../middleware/session';
import { canViewAvatar } from '../../policies/avatar';

const idSchema = z.uuid();

export function usersRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/:id/avatar', async (req, res) => {
    const ownerId = idSchema.safeParse(req.params.id);
    // "Not allowed" and "doesn't exist" look the same from outside.
    if (!ownerId.success || !(await canViewAvatar(currentUserId(req), ownerId.data))) {
      throw new HttpError(404, 'not_found');
    }
    const profile = await ctx.prisma.userProfile.findUnique({
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

  return router;
}
