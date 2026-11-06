import {
  REACTION_TYPES,
  fromUtcDate,
  type AchievementCode,
  type EarnedAchievement,
  type FriendSession,
  type PublicUser,
  type ReactionSummary,
  type ReactionTargetType,
  type ReactionType,
} from '@pace/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { toApi, toDb } from '../../lib/enums';
import { avatarUrl } from '../me/me.mapper';
import { sportSelect } from '../training/training.mapper';

/** The only user fields that ever leave the server for someone else. */
export const publicUserSelect = {
  userId: true,
  username: true,
  firstName: true,
  avatarKey: true,
} satisfies Prisma.UserProfileSelect;

export const toPublicUser = (p: {
  userId: string;
  username: string;
  firstName: string;
  avatarKey: string | null;
}): PublicUser => ({
  id: p.userId,
  username: p.username,
  firstName: p.firstName,
  avatarUrl: avatarUrl(p.userId, p.avatarKey),
});

/**
 * A session as a friend sees it: date, sport and duration. Motivation, rating, intensity
 * and the reflection only when the owner shared this particular session.
 */
export const friendSessionSelect = {
  id: true,
  userId: true,
  date: true,
  durationMinutes: true,
  shareDetails: true,
  motivation: true,
  rating: true,
  intensity: true,
  reflection: true,
  createdAt: true,
  sport: { select: sportSelect },
} satisfies Prisma.TrainingSessionSelect;

type SessionRow = Prisma.TrainingSessionGetPayload<{ select: typeof friendSessionSelect }>;

export const toFriendSession = (s: SessionRow): FriendSession => ({
  id: s.id,
  date: fromUtcDate(s.date),
  sport: s.sport,
  durationMinutes: s.durationMinutes,
  details: s.shareDetails
    ? {
        motivation: s.motivation,
        rating: s.rating,
        intensity: s.intensity,
        reflection: s.reflection,
      }
    : null,
});

export const achievementSelect = {
  id: true,
  userId: true,
  periodKey: true,
  earnedAt: true,
  achievement: { select: { code: true } },
} satisfies Prisma.UserAchievementSelect;

type AchievementRow = Prisma.UserAchievementGetPayload<{ select: typeof achievementSelect }>;

export const toEarned = (a: AchievementRow, reactions: ReactionSummary): EarnedAchievement => ({
  id: a.id,
  code: a.achievement.code as AchievementCode,
  period: a.periodKey || null,
  earnedAt: a.earnedAt.toISOString(),
  reactions,
});

const emptySummary = (): ReactionSummary => ({
  counts: { respect: 0, well_done: 0, keep_going: 0 },
  mine: [],
});

/** Reaction counts per item, plus which ones the viewer gave. */
export async function reactionSummaries(
  prisma: Pick<PrismaClient, 'reaction'>,
  viewerId: string,
  targetType: ReactionTargetType,
  ids: string[],
): Promise<(id: string) => ReactionSummary> {
  const map = new Map<string, ReactionSummary>();
  if (ids.length) {
    const rows = await prisma.reaction.findMany({
      where: { targetType: toDb(targetType), targetId: { in: ids } },
      select: { targetId: true, type: true, fromUserId: true },
    });
    for (const r of rows) {
      const summary = map.get(r.targetId) ?? emptySummary();
      const type = toApi<ReactionType>(r.type);
      if (REACTION_TYPES.includes(type)) summary.counts[type]++;
      if (r.fromUserId === viewerId) summary.mine.push(type);
      map.set(r.targetId, summary);
    }
  }
  return (id) => map.get(id) ?? emptySummary();
}
