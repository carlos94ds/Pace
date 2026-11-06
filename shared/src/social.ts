import { z } from 'zod';
import type { Gym, Sport, TrainingLevel } from './profile';
import type { GoalResult } from './goals';

/** What anyone who may see a user at all gets: never more than this. */
export interface PublicUser {
  id: string;
  username: string;
  firstName: string;
  avatarUrl: string | null;
}

/** The viewer's relationship to another user. */
export type Relation = 'self' | 'friends' | 'incoming' | 'outgoing' | 'none';

export interface UserCard extends PublicUser {
  relation: Relation;
  /** Set for 'incoming' and 'outgoing', to accept, decline or cancel. */
  requestId: string | null;
}

export const userSearchSchema = z.object({ q: z.string().trim().min(2).max(60) });
export const friendRequestSchema = z.object({ userId: z.uuid() });

export interface FriendRequests {
  incoming: (UserCard & { sentAt: string })[];
  outgoing: (UserCard & { sentAt: string })[];
}

export interface Suggestion extends UserCard {
  mutualFriends: number;
}

export const REACTION_TYPES = ['respect', 'well_done', 'keep_going'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];
export const REACTION_TARGETS = ['session', 'achievement'] as const;
export type ReactionTargetType = (typeof REACTION_TARGETS)[number];

export const reactionInputSchema = z.object({
  targetType: z.enum(REACTION_TARGETS),
  targetId: z.uuid(),
  type: z.enum(REACTION_TYPES),
});
export type ReactionInput = z.infer<typeof reactionInputSchema>;

export interface ReactionSummary {
  counts: Record<ReactionType, number>;
  /** The viewer's own reactions on this item. */
  mine: ReactionType[];
}

/** Only present when the owner shared this session's details. */
export interface SharedSessionDetails {
  motivation: number;
  rating: number;
  intensity: number;
  reflection: string | null;
}

export interface FriendSession {
  id: string;
  date: string;
  sport: Sport;
  durationMinutes: number;
  details: SharedSessionDetails | null;
}

export const ACHIEVEMENT_CODES = [
  'FIRST_SESSION',
  'STREAK_3W',
  'STREAK_7W',
  'STREAK_26W',
  'WEEK_20H',
  'TOTAL_100H',
  'TOTAL_500H',
  'WEEKLY_GOAL',
] as const;
export type AchievementCode = (typeof ACHIEVEMENT_CODES)[number];

export interface EarnedAchievement {
  id: string;
  code: AchievementCode;
  /** ISO week (e.g. "2026-W45") for repeatable achievements, otherwise null. */
  period: string | null;
  earnedAt: string;
  reactions: ReactionSummary;
}

/** The catalogue with the viewer's own progress. */
export interface MyAchievements {
  catalogue: { code: AchievementCode; earned: number; lastEarnedAt: string | null }[];
  recent: EarnedAchievement[];
}

export type FeedItem =
  | ({
      kind: 'session';
      user: PublicUser;
      createdAt: string;
      reactions: ReactionSummary;
    } & FriendSession)
  | ({ kind: 'achievement'; user: PublicUser; createdAt: string } & EarnedAchievement);

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

/**
 * Another user's profile as the viewer may see it. Every section is null when the
 * owner's privacy settings (or the relationship) don't allow it.
 */
export interface UserProfileView {
  user: UserCard;
  profile: {
    bio: string | null;
    trainingLevel: TrainingLevel;
    gym: Gym | null;
    sports: Sport[];
  } | null;
  activity: {
    weeks: { weekStart: string; minutes: number }[];
    recent: (FriendSession & { reactions: ReactionSummary })[];
  } | null;
  streaks: { current: number | null; longest: number | null } | null;
  achievements: EarnedAchievement[] | null;
  /** The latest weekly report's numbers, without reflections or analysis text. */
  report: {
    weekStart: string;
    totalMinutes: number;
    trainingDays: number;
    sessions: number;
    punctualityPct: number | null;
    goalResults: GoalResult[];
  } | null;
}
