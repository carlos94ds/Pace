import { fromUtcDate, todayIn, toUtcDate, type IsoDate, type Sport } from '@pace/shared';
import type { PrismaClient } from '../../generated/prisma/client';
import { toApi } from '../../lib/enums';
import { sportSelect } from '../training/training.mapper';
import { trainingDaysPerWeek, type GoalFact, type SessionFact } from './metrics';

type Db = Pick<PrismaClient, 'trainingSession' | 'weeklyGoal' | 'sport' | 'userProfile'>;

export async function loadTimezone(prisma: Db, userId: string) {
  const { timezone } = await prisma.userProfile.findUniqueOrThrow({
    where: { userId },
    select: { timezone: true },
  });
  return timezone;
}

/** Sessions in a date range, with the sports they use. */
export async function loadSessions(prisma: Db, userId: string, from: IsoDate, to: IsoDate) {
  const rows = await prisma.trainingSession.findMany({
    where: { userId, date: { gte: toUtcDate(from), lte: toUtcDate(to) } },
    select: {
      id: true,
      date: true,
      durationMinutes: true,
      punctuality: true,
      sportId: true,
      motivation: true,
      rating: true,
      intensity: true,
      energy: true,
      injured: true,
      injuryNote: true,
      injuryCause: true,
      ratingReason: true,
      energyReason: true,
      reflection: true,
      sport: { select: sportSelect },
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  const sports = new Map<string, Sport>(rows.map((r) => [r.sport.id, r.sport]));
  const sessions: SessionFact[] = rows.map(({ sport: _, ...r }) => ({
    ...r,
    date: fromUtcDate(r.date),
    punctuality: toApi(r.punctuality),
  }));
  return { sessions, sports };
}

/** All goals, archived ones included, with the local dates they were created and archived. */
export async function loadGoals(prisma: Db, userId: string, timezone: string) {
  const rows = await prisma.weeklyGoal.findMany({
    where: { userId },
    select: {
      id: true,
      type: true,
      target: true,
      sportId: true,
      createdAt: true,
      archivedAt: true,
      sport: { select: sportSelect },
    },
    orderBy: { createdAt: 'asc' },
  });
  const sports = new Map<string, Sport>(
    rows.flatMap((r) => (r.sport ? [[r.sport.id, r.sport]] : [])),
  );
  const goals: GoalFact[] = rows.map((r) => ({
    id: r.id,
    type: toApi(r.type),
    target: r.target,
    sportId: r.sportId,
    createdOn: todayIn(timezone, r.createdAt),
    archivedOn: r.archivedAt ? todayIn(timezone, r.archivedAt) : null,
  }));
  return { goals, sports };
}

/** Training days per week over the user's whole history (for streaks). */
export async function loadDaysPerWeek(prisma: Db, userId: string) {
  const days = await prisma.trainingSession.groupBy({ by: ['date'], where: { userId } });
  return trainingDaysPerWeek(days.map((d) => fromUtcDate(d.date)));
}

export const mergeSports = (...maps: Map<string, Sport>[]) => new Map(maps.flatMap((m) => [...m]));
