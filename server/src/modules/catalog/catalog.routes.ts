import { createGymSchema, sportInputSchema } from '@pace/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { Prisma } from '../../generated/prisma/client';
import { HttpError } from '../../middleware/errors';
import { currentUserId, requireAuth } from '../../middleware/session';
import { parseBody } from '../../middleware/validate';

const gymSelect = { id: true, name: true, city: true } as const;
const sportSelect = { id: true, slug: true, name: true, color: true } as const;

/** Enough for anyone's own sports, while keeping the picker usable. */
export const MAX_CUSTOM_SPORTS = 50;

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/** Sports and gyms that users pick from. */
export function catalogRouter(ctx: AppContext): Router {
  const router = Router();
  const { prisma } = ctx;
  router.use(requireAuth);

  router.get('/sports', async (req, res) => {
    const sports = await prisma.sport.findMany({
      where: { OR: [{ ownerId: null }, { ownerId: currentUserId(req) }] },
      select: sportSelect,
      orderBy: { name: 'asc' },
    });
    res.json(sports);
  });

  router.post('/sports', async (req, res) => {
    const ownerId = currentUserId(req);
    const input = parseBody(sportInputSchema, req);
    if ((await prisma.sport.count({ where: { ownerId } })) >= MAX_CUSTOM_SPORTS) {
      throw new HttpError(409, 'limit_reached');
    }
    try {
      const sport = await prisma.sport.create({
        data: { ...input, ownerId },
        select: sportSelect,
      });
      res.status(201).json(sport);
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, 'conflict', { name: 'taken' });
      throw err;
    }
  });

  // Built-in sports have no owner, so they can never match these filters.
  const ownSport = (req: Request) => {
    const parsed = z.object({ id: z.uuid() }).safeParse(req.params);
    if (!parsed.success) throw new HttpError(404, 'not_found');
    return { id: parsed.data.id, ownerId: currentUserId(req) };
  };

  router.put('/sports/:id', async (req, res) => {
    const where = ownSport(req);
    const input = parseBody(sportInputSchema, req);
    try {
      const { count } = await prisma.sport.updateMany({ where, data: input });
      if (!count) throw new HttpError(404, 'not_found');
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, 'conflict', { name: 'taken' });
      throw err;
    }
    res.json(await prisma.sport.findFirstOrThrow({ where, select: sportSelect }));
  });

  router.delete('/sports/:id', async (req, res) => {
    const where = ownSport(req);
    if (!(await prisma.sport.count({ where }))) throw new HttpError(404, 'not_found');
    // Sessions keep their sport (Restrict in the schema), so history never loses data.
    const sessions = await prisma.trainingSession.count({ where: { sportId: where.id } });
    if (sessions) throw new HttpError(409, 'sport_in_use');
    await prisma.sport.deleteMany({ where });
    res.status(204).end();
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
      if (isUniqueViolation(err)) {
        res.json(await prisma.gym.findFirstOrThrow({ where: input, select: gymSelect }));
        return;
      }
      throw err;
    }
  });

  return router;
}
