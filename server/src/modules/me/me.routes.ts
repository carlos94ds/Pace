import { randomUUID } from 'node:crypto';
import {
  changeEmailSchema,
  changePasswordSchema,
  deleteAccountSchema,
  updatePreferencesSchema,
  updatePrivacySchema,
  updateProfileSchema,
} from '@pace/shared';
import { Router } from 'express';
import multer from 'multer';
import type { AppContext } from '../../context';
import type { Prisma } from '../../generated/prisma/client';
import { hashPassword, verifyPassword } from '../../lib/crypto';
import { toDb } from '../../lib/enums';
import { queueFileDeletions, tryProcessFileDeletions } from '../../lib/file-deletions';
import { HttpError } from '../../middleware/errors';
import { clearSessionCookie, currentUserId, requireAuth } from '../../middleware/session';
import { parseBody } from '../../middleware/validate';
import { AVATAR_MAX_BYTES, processAvatar } from './avatar';
import { loadMe } from './me.mapper';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 0 },
});

export function meRouter(ctx: AppContext): Router {
  const router = Router();
  const { prisma } = ctx;
  router.use(requireAuth);

  async function requirePassword(userId: string, password: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new HttpError(403, 'wrong_password', { password: 'wrong_password' });
    }
  }

  router.get('/', async (req, res) => {
    res.json(await loadMe(prisma, currentUserId(req)));
  });

  router.patch('/profile', async (req, res) => {
    const userId = currentUserId(req);
    const { sportIds, gymId, trainingLevel, username, ...rest } = parseBody(
      updateProfileSchema,
      req,
    );

    if (username) {
      const owner = await prisma.userProfile.findUnique({
        where: { username },
        select: { userId: true },
      });
      if (owner && owner.userId !== userId)
        throw new HttpError(409, 'conflict', { username: 'taken' });
    }
    if (gymId && !(await prisma.gym.findUnique({ where: { id: gymId }, select: { id: true } }))) {
      throw new HttpError(400, 'validation_error', { gymId: 'not_found' });
    }
    if (sportIds) {
      // Only built-in sports and the user's own custom sports may be linked.
      const allowed = await prisma.sport.count({
        where: { id: { in: sportIds }, OR: [{ ownerId: null }, { ownerId: userId }] },
      });
      if (allowed !== new Set(sportIds).size) {
        throw new HttpError(400, 'validation_error', { sportIds: 'not_found' });
      }
    }

    const data: Prisma.UserProfileUpdateInput = {
      ...rest,
      ...(username && { username }),
      ...(trainingLevel && { trainingLevel: toDb(trainingLevel) }),
      ...(gymId !== undefined && {
        gym: gymId ? { connect: { id: gymId } } : { disconnect: true },
      }),
    };

    await prisma.$transaction(async (tx) => {
      await tx.userProfile.update({ where: { userId }, data });
      if (sportIds) {
        await tx.userSport.deleteMany({ where: { userId } });
        await tx.userSport.createMany({
          data: [...new Set(sportIds)].map((sportId) => ({ userId, sportId })),
        });
      }
    });
    res.json(await loadMe(prisma, userId));
  });

  router.patch('/preferences', async (req, res) => {
    const userId = currentUserId(req);
    const { language, theme, textSize, notifications: n } = parseBody(updatePreferencesSchema, req);
    await prisma.userPreferences.update({
      where: { userId },
      data: {
        ...(language && { language: toDb(language) }),
        ...(theme && { theme: toDb(theme) }),
        ...(textSize && { textSize: toDb(textSize) }),
        notifyFriendRequests: n?.friendRequests,
        notifyFriendAccepted: n?.friendAccepted,
        notifyFriendMilestones: n?.friendMilestones,
        notifyReactions: n?.reactions,
        notifyWeeklyReport: n?.weeklyReport,
        notifyStreaks: n?.streaks,
        notifyGoals: n?.goals,
      },
    });
    res.json(await loadMe(prisma, userId));
  });

  router.patch('/privacy', async (req, res) => {
    const userId = currentUserId(req);
    const p = parseBody(updatePrivacySchema, req);
    const visibility = (v: string | undefined) => (v ? toDb<'PRIVATE' | 'FRIENDS'>(v) : undefined);
    await prisma.privacySettings.update({
      where: { userId },
      data: {
        discoverable: p.discoverable,
        profileVisibility: visibility(p.profile),
        activityVisibility: visibility(p.activity),
        streaksVisibility: visibility(p.streaks),
        achievementsVisibility: visibility(p.achievements),
        dashboardVisibility: visibility(p.dashboard),
        weightVisibility: visibility(p.weight),
      },
    });
    res.json(await loadMe(prisma, userId));
  });

  router.put('/email', async (req, res) => {
    const userId = currentUserId(req);
    const { email, password } = parseBody(changeEmailSchema, req);
    await requirePassword(userId, password);
    const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (owner && owner.id !== userId) throw new HttpError(409, 'conflict', { email: 'taken' });
    await prisma.user.update({ where: { id: userId }, data: { email, emailVerifiedAt: null } });
    res.json(await loadMe(prisma, userId));
  });

  router.put('/password', async (req, res) => {
    const userId = currentUserId(req);
    const { currentPassword, newPassword } = parseBody(changePasswordSchema, req);
    await requirePassword(userId, currentPassword).catch(() => {
      throw new HttpError(403, 'wrong_password', { currentPassword: 'wrong_password' });
    });
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword(newPassword) },
      }),
      // Other devices are logged out; this one stays logged in.
      prisma.authSession.deleteMany({ where: { userId, id: { not: req.auth!.sessionId } } }),
    ]);
    res.status(204).end();
  });

  router.post('/avatar', upload.single('avatar'), async (req, res) => {
    const userId = currentUserId(req);
    if (!req.file) throw new HttpError(400, 'validation_error', { avatar: 'required' });
    const image = await processAvatar(req.file.buffer);

    const key = `avatars/${userId}/${randomUUID()}.webp`;
    await ctx.storage.put(key, image, 'image/webp');

    const old = await prisma.userProfile.findUniqueOrThrow({
      where: { userId },
      select: { avatarKey: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.userProfile.update({ where: { userId }, data: { avatarKey: key } });
      if (old.avatarKey) await queueFileDeletions(tx, [old.avatarKey]);
    });
    if (old.avatarKey) await tryProcessFileDeletions(ctx, [old.avatarKey]);
    res.json(await loadMe(prisma, userId));
  });

  router.delete('/avatar', async (req, res) => {
    const userId = currentUserId(req);
    const { avatarKey } = await prisma.userProfile.findUniqueOrThrow({
      where: { userId },
      select: { avatarKey: true },
    });
    if (avatarKey) {
      await prisma.$transaction(async (tx) => {
        await tx.userProfile.update({ where: { userId }, data: { avatarKey: null } });
        await queueFileDeletions(tx, [avatarKey]);
      });
      await tryProcessFileDeletions(ctx, [avatarKey]);
    }
    res.json(await loadMe(prisma, userId));
  });

  /** Deletes the account, all its data (database cascade) and all its files. */
  router.delete('/', async (req, res) => {
    const userId = currentUserId(req);
    const { password } = parseBody(deleteAccountSchema, req);
    await requirePassword(userId, password);

    const keys = await prisma.$transaction(async (tx) => {
      const [profile, evidence] = await Promise.all([
        tx.userProfile.findUnique({ where: { userId }, select: { avatarKey: true } }),
        tx.weightEvidence.findMany({
          where: { measurement: { userId } },
          select: { storageKey: true },
        }),
      ]);
      const keys = [profile?.avatarKey, ...evidence.map((e) => e.storageKey)].filter(
        (k): k is string => Boolean(k),
      );
      await queueFileDeletions(tx, keys);
      // Sessions first: a custom sport can't be removed while sessions still use it
      // (Restrict), and MySQL doesn't order the two cascades from User for us.
      await tx.trainingSession.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
      return keys;
    });
    await tryProcessFileDeletions(ctx, keys);

    clearSessionCookie(ctx, res);
    res.status(204).end();
  });

  return router;
}
