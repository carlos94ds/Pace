import { fromUtcDate, type TrainingSession } from '@pace/shared';
import type { Prisma } from '../../generated/prisma/client';
import { toApi } from '../../lib/enums';

export const sportSelect = { id: true, slug: true, name: true, color: true } as const;
export const gymSelect = { id: true, name: true, city: true } as const;

export const sessionSelect = {
  id: true,
  date: true,
  durationMinutes: true,
  punctuality: true,
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
  shareDetails: true,
  createdAt: true,
  updatedAt: true,
  sport: { select: sportSelect },
  gym: { select: gymSelect },
} satisfies Prisma.TrainingSessionSelect;

type Row = Prisma.TrainingSessionGetPayload<{ select: typeof sessionSelect }>;

/** The owner's full view of a session. Friends get a separate, smaller mapper (phase 5). */
export function toOwnerSession(row: Row): TrainingSession {
  return {
    ...row,
    date: fromUtcDate(row.date),
    punctuality: toApi(row.punctuality),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
