import { createGymSchema } from '@pace/shared';
import { Router } from 'express';
import type { AppContext } from '../../context';
import { Prisma } from '../../generated/prisma/client';
import { currentUserId, requireAuth } from '../../middleware/session';
import { parseBody } from '../../middleware/validate';

const gymSelect = { id: true, name: true, city: true } as const;

/** Sports and gyms that users pick from. */
export function catalogRouter(ctx: AppContext): Router {
  const router = Router();
  const { prisma } = ctx;
  router.use(requireAuth);

  router.get('/sports', async (req, res) => {
    const sports = await prisma.sport.findMany({
      where: { OR: [{ ownerId: null }, { ownerId: currentUserId(req) }] },
      select: { id: true, slug: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });
    res.json(sports);
  });

  router.get('/gyms', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (q.length < 2) {
      res.json([]);
      return;
    }
    const gyms = await prisma.gym.findMany({
      where: { OR: [{ name: { contains: q } }, { city: { contains: q } }] },
      select: gymSelect,
      orderBy: { name: 'asc' },
      take: 10,
    });
    res.json(gyms);
  });

  router.post('/gyms', async (req, res) => {
    const input = parseBody(createGymSchema, req);
    // The shared list is deduplicated by name + city (case-insensitive in MySQL).
    const existing = await prisma.gym.findFirst({ where: input, select: gymSelect });
    if (existing) {
      res.json(existing);
      return;
    }
    try {
      const gym = await prisma.gym.create({
        data: { ...input, createdById: currentUserId(req) },
        select: gymSelect,
      });
      res.status(201).json(gym);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        res.json(await prisma.gym.findFirstOrThrow({ where: input, select: gymSelect }));
        return;
      }
      throw err;
    }
  });

  return router;
}
