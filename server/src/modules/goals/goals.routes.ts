import { goalInputSchema, type Goal, type GoalInput, type GoalType } from '@pace/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { toApi, toDb } from '../../lib/enums';
import { HttpError } from '../../middleware/errors';
import { currentUserId, requireAuth } from '../../middleware/session';
import { parseBody } from '../../middleware/validate';
import { sportSelect } from '../training/training.mapper';

const MAX_ACTIVE_GOALS = 10;

const goalSelect = {
  id: true,
  type: true,
  target: true,
  createdAt: true,
  sport: { select: sportSelect },
} satisfies Prisma.WeeklyGoalSelect;

type Row = Prisma.WeeklyGoalGetPayload<{ select: typeof goalSelect }>;

const toGoal = (row: Row): Goal => ({
  id: row.id,
  type: toApi<GoalType>(row.type),
  target: row.target,
  sport: row.sport,
  createdAt: row.createdAt.toISOString(),
});

const dbType = (type: GoalType) =>
  toDb<'TOTAL_MINUTES' | 'TRAINING_DAYS' | 'PUNCTUALITY_PCT' | 'SPORT_SESSIONS'>(type);

function goalId(req: Request) {
  const parsed = z.object({ id: z.uuid() }).safeParse(req.params);
  if (!parsed.success) throw new HttpError(404, 'not_found');
  return parsed.data.id;
}

/** Only one active goal per type (per sport for sport goals), and only usable sports. */
async function checkGoal(
  prisma: PrismaClient,
  userId: string,
  input: GoalInput,
  replacing?: string,
) {
  if (input.sportId) {
    const sport = await prisma.sport.count({
      where: { id: input.sportId, OR: [{ ownerId: null }, { ownerId: userId }] },
    });
    if (!sport) throw new HttpError(400, 'validation_error', { sportId: 'not_found' });
  }
  const duplicate = await prisma.weeklyGoal.count({
    where: {
      userId,
      archivedAt: null,
      type: dbType(input.type),
      sportId: input.sportId,
      ...(replacing && { id: { not: replacing } }),
    },
  });
  if (duplicate) throw new HttpError(409, 'conflict', { type: 'taken' });
}

/**
 * Weekly goals. Changing or deleting a goal archives the old version instead of
 * overwriting it, so past weeks are still measured against the target they had.
 */
export function goalsRouter(ctx: AppContext): Router {
  const router = Router();
  const { prisma } = ctx;
  router.use(requireAuth);

  router.get('/goals', async (req, res) => {
    const rows = await prisma.weeklyGoal.findMany({
      where: { userId: currentUserId(req), archivedAt: null },
      select: goalSelect,
      orderBy: { createdAt: 'asc' },
    });
    res.json(rows.map(toGoal));
  });

  router.post('/goals', async (req, res) => {
    const userId = currentUserId(req);
    const input = parseBody(goalInputSchema, req);
    if (
      (await prisma.weeklyGoal.count({ where: { userId, archivedAt: null } })) >= MAX_ACTIVE_GOALS
    ) {
      throw new HttpError(409, 'limit_reached');
    }
    await checkGoal(prisma, userId, input);
    const row = await prisma.weeklyGoal.create({
      data: { userId, type: dbType(input.type), target: input.target, sportId: input.sportId },
      select: goalSelect,
    });
    res.status(201).json(toGoal(row));
  });

  router.put('/goals/:id', async (req, res) => {
    const userId = currentUserId(req);
    const id = goalId(req);
    const input = parseBody(goalInputSchema, req);
    const current = await prisma.weeklyGoal.findFirst({ where: { id, userId, archivedAt: null } });
    if (!current) throw new HttpError(404, 'not_found');
    await checkGoal(prisma, userId, input, id);
    const row = await prisma.$transaction(async (tx) => {
      await tx.weeklyGoal.update({
        where: { id },
        data: { active: false, archivedAt: new Date() },
      });
      return tx.weeklyGoal.create({
        data: { userId, type: dbType(input.type), target: input.target, sportId: input.sportId },
        select: goalSelect,
      });
    });
    res.json(toGoal(row));
  });

  router.delete('/goals/:id', async (req, res) => {
    const { count } = await prisma.weeklyGoal.updateMany({
      where: { id: goalId(req), userId: currentUserId(req), archivedAt: null },
      data: { active: false, archivedAt: new Date() },
    });
    if (!count) throw new HttpError(404, 'not_found');
    res.status(204).end();
  });

  return router;
}
