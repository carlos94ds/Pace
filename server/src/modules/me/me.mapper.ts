import type {
  Language,
  Me,
  NotificationKey,
  TextSize,
  Theme,
  TrainingLevel,
  Visibility,
} from '@pace/shared';
import type { PrismaClient } from '../../generated/prisma/client';
import { toApi } from '../../lib/enums';
import { HttpError } from '../../middleware/errors';

export function avatarUrl(userId: string, avatarKey: string | null): string | null {
  if (!avatarKey) return null;
  // The key changes on every upload, so it doubles as a cache-busting version.
  const version = avatarKey.split('/').pop()?.split('.')[0];
  return `/api/v1/users/${userId}/avatar?v=${version}`;
}

/** The full account of the logged-in user. Never use this for anyone else. */
export async function loadMe(prisma: PrismaClient, userId: string): Promise<Me> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      gyms: { include: { gym: true }, orderBy: { position: 'asc' } },
      preferences: true,
      privacy: true,
      sports: { include: { sport: true }, orderBy: { sport: { name: 'asc' } } },
    },
  });
  if (!user?.profile || !user.preferences || !user.privacy)
    throw new HttpError(401, 'unauthenticated');
  const { profile, preferences: p, privacy } = user;

  const notifications: Record<NotificationKey, boolean> = {
    friendRequests: p.notifyFriendRequests,
    friendAccepted: p.notifyFriendAccepted,
    friendMilestones: p.notifyFriendMilestones,
    reactions: p.notifyReactions,
    weeklyReport: p.notifyWeeklyReport,
    streaks: p.notifyStreaks,
    goals: p.notifyGoals,
  };

  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    profile: {
      username: profile.username,
      firstName: profile.firstName,
      bio: profile.bio,
      avatarUrl: avatarUrl(user.id, profile.avatarKey),
      heightCm: profile.heightCm,
      trainingLevel: toApi<TrainingLevel>(profile.trainingLevel),
      personalGoals: profile.personalGoals,
      timezone: profile.timezone,
      gyms: user.gyms.map(({ gym }) => ({ id: gym.id, name: gym.name, city: gym.city })),
      sports: user.sports.map(({ sport }) => ({
        id: sport.id,
        slug: sport.slug,
        name: sport.name,
        color: sport.color,
      })),
    },
    preferences: {
      language: toApi<Language>(p.language),
      theme: toApi<Theme>(p.theme),
      textSize: toApi<TextSize>(p.textSize),
      notifications,
    },
    privacy: {
      discoverable: privacy.discoverable,
      profile: toApi<Visibility>(privacy.profileVisibility),
      activity: toApi<Visibility>(privacy.activityVisibility),
      streaks: toApi<Visibility>(privacy.streaksVisibility),
      achievements: toApi<Visibility>(privacy.achievementsVisibility),
      dashboard: toApi<Visibility>(privacy.dashboardVisibility),
      weight: toApi<Visibility>(privacy.weightVisibility),
    },
  };
}
