import type { PublicUser } from './social';

export const NOTIFICATION_TYPES = [
  'friend_request',
  'friend_accepted',
  'friend_achievement',
  'reaction',
  'weekly_report',
  'streak_milestone',
  'goal_achieved',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface AppNotification {
  id: string;
  type: NotificationType;
  /** Translation key and parameters; the text is built in the client's language. */
  key: string;
  params: Record<string, string | number>;
  link: string | null;
  actor: PublicUser | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: AppNotification[];
  nextCursor: string | null;
  unread: number;
}
