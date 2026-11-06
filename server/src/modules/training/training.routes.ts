import {
  daysInRange,
  sessionInputSchema,
  sessionListQuerySchema,
  statsQuerySchema,
  todayIn,
  toUtcDate,
  type SessionInput,
  type SessionPage,
  type TrainingStats,
} from '@pace/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { toDb } from '../../lib/enums';
import { HttpError } from '../../middleware/errors';
import { currentUserId, requireAuth } from '../../middleware/session';
import { parseBody, parseQuery } from '../../middleware/validate';
import { sessionSelect, sportSelect, toOwnerSession } from './training.mapper';

/** The calendar loads one visible month (up to 6 weeks) at a time. */
const MAX_CALENDAR_DAYS = 62;
/** Statistics cover at most ~10 years per request. */
const MAX_STATS_DAYS = 3700;

const idParam = z.object({ id: z.uuid() });

function sessionId(params: unknown) {
  const parsed = idParam.safeParse(params);
  // An invalid id can't belong to anyone: same answer as someone else's id.
  if (!parsed.success) throw new HttpError(404, 'not_found');
  return parsed.data.id;
}

/** Checks references and dates the schema can't check on its own. */
async function checkSessionInput(prisma: PrismaClient, userId: string, input: SessionInput) {
  const [sport, gym, profile] = await Promise.all([
    prisma.sport.findFirst({
      where: { id: input.sportId, OR: [{ ownerId: null }, { ownerId: userId }] },
      select: { id: true },
    }),
    input.gymId
      ? prisma.gym.findUnique({ where: { id: input.gymId }, select: { id: true } })
      : null,
    prisma.userProfile.findUniqueOrThrow({ where: { userId }, select: { timezone: true } }),
  ]);
  const fields: Record<string, string> = {};
  if (!sport) fields.sportId = 'not_found';
  if (input.gymId && !gym) fields.gymId = 'not_found';
  // Sessions are logged after training; "today" is the user's own calendar day.
  if (input.date > todayIn(profile.timezone)) fields.date = 'in_future';
  if (Object.keys(fields).length) throw new HttpError(400, 'validation_error', fields);
}

const toData = (input: SessionInput) => ({
  ...input,
  date: toUtcDate(input.date),
  punctuality: toDb<'ON_TIME' | 'LATE'>(input.punctuality),
});

export function trainingRouter(ctx: AppContext): Router {
  const router = Router();
  const { prisma } = ctx;
  router.use(requireAuth);

  // History list with filters, newest first, cursor-paginated.
  router.get('/sessions', async (req, res) => {
    const q = parseQuery(sessionListQuerySchema, req);
    const userId = currentUserId(req);
    const where: Prisma.TrainingSessionWhereInput = {
      userId,
      ...((q.from || q.to) && {
        date: {
          ...(q.from && { gte: toUtcDate(q.from) }),
          ...(q.to && { lte: toUtcDate(q.to) }),
        },
      }),
      ...(q.sportId && { sportId: q.sportId }),
      ...(q.gymId && { gymId: q.gymId }),
      ...(q.punctuality && { punctuality: toDb<'ON_TIME' | 'LATE'>(q.punctuality) }),
    };
    if (q.cursor) {
      // The cursor must be one of this user's sessions, or it could reveal another user's ids.
      const owned = await prisma.trainingSession.count({ where: { id: q.cursor, userId } });
      if (!owned) throw new HttpError(400, 'validation_error', { cursor: 'not_found' });
    }
    const rows = await prisma.trainingSession.findMany({
      where,
      select: sessionSelect,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
    });
    const page: SessionPage = {
      items: rows.slice(0, q.limit).map(toOwnerSession),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
    res.json(page);
  });

  // Every session in a date range, for the calendar.
  router.get('/sessions/calendar', async (req, res) => {
    const { from, to } = parseQuery(statsQuerySchema, req);
    if (daysInRange(from, to) > MAX_CALENDAR_DAYS) {
      throw new HttpError(400, 'validation_error', { to: 'too_big' });
    }
    const rows = await prisma.trainingSession.findMany({
      where: { userId: currentUserId(req), date: { gte: toUtcDate(from), lte: toUtcDate(to) } },
      select: sessionSelect,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(rows.map(toOwnerSession));
  });

  router.get('/sessions/:id', async (req, res) => {
    const row = await prisma.trainingSession.findFirst({
      where: { id: sessionId(req.params), userId: currentUserId(req) },
      select: sessionSelect,
    });
    if (!row) throw new HttpError(404, 'not_found');
    res.json(toOwnerSession(row));
  });

  router.post('/sessions', async (req, res) => {
    const userId = currentUserId(req);
    const input = parseBody(sessionInputSchema, req);
    await checkSessionInput(prisma, userId, input);
    const row = await prisma.trainingSession.create({
      data: { ...toData(input), userId },
      select: sessionSelect,
    });
    res.status(201).json(toOwnerSession(row));
  });

  router.put('/sessions/:id', async (req, res) => {
    const userId = currentUserId(req);
    const id = sessionId(req.params);
    const input = parseBody(sessionInputSchema, req);
    // updateMany with the owner in the filter: someone else's session is simply not matched.
    if (!(await prisma.trainingSession.count({ where: { id, userId } }))) {
      throw new HttpError(404, 'not_found');
    }
    await checkSessionInput(prisma, userId, input);
    const { count } = await prisma.trainingSession.updateMany({
      where: { id, userId },
      data: toData(input),
    });
    if (!count) throw new HttpError(404, 'not_found');
    const row = await prisma.trainingSession.findFirstOrThrow({
      where: { id, userId },
      select: sessionSelect,
    });
    res.json(toOwnerSession(row));
  });

  router.delete('/sessions/:id', async (req, res) => {
    const { count } = await prisma.trainingSession.deleteMany({
      where: { id: sessionId(req.params), userId: currentUserId(req) },
    });
    if (!count) throw new HttpError(404, 'not_found');
    res.status(204).end();
  });

  // Totals for a period, computed by the database.
  router.get('/stats/summary', async (req, res) => {
    const { from, to } = parseQuery(statsQuerySchema, req);
    if (daysInRange(from, to) > MAX_STATS_DAYS) {
      throw new HttpError(400, 'validation_error', { from: 'too_big' });
    }
    const where = {
      userId: currentUserId(req),
      date: { gte: toUtcDate(from), lte: toUtcDate(to) },
    };
    const [bySport, days] = await Promise.all([
      prisma.trainingSession.groupBy({
        by: ['sportId'],
        where,
        _sum: { durationMinutes: true },
        _count: { _all: true },
      }),
      // Two sessions on one day are one training day.
      prisma.trainingSession.groupBy({ by: ['date'], where }),
    ]);
    const sports = await prisma.sport.findMany({
      where: { id: { in: bySport.map((s) => s.sportId) } },
      select: sportSelect,
    });
    const sportById = new Map(sports.map((s) => [s.id, s]));
    const perSport = bySport
      .map((s) => ({
        sport: sportById.get(s.sportId)!,
        sessions: s._count._all,
        minutes: s._sum.durationMinutes ?? 0,
      }))
      .sort((a, b) => b.minutes - a.minutes || b.sessions - a.sessions);

    const stats: TrainingStats = {
      from,
      to,
      sessions: perSport.reduce((n, s) => n + s.sessions, 0),
      trainingDays: days.length,
      totalMinutes: perSport.reduce((n, s) => n + s.minutes, 0),
      perSport,
    };
    res.json(stats);
  });

  return router;
}
