/**
 * The single place that decides what one user may see of another (docs/ARCHITECTURE.md §5).
 * Routes ask these functions; they never check friendships or privacy settings themselves.
 */
import type { PrivacyKey, Relation } from '@pace/shared';
import type { PrismaClient } from '../generated/prisma/client';

type Db = Pick<PrismaClient, 'friendship' | 'privacySettings'>;

export const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export interface RelationInfo {
  relation: Relation;
  requestId: string | null;
}

/**
 * A declined request still looks pending to the person who sent it, so nobody learns
 * that they were declined.
 */
export async function getRelation(
  prisma: Db,
  viewerId: string,
  otherId: string,
): Promise<RelationInfo> {
  if (viewerId === otherId) return { relation: 'self', requestId: null };
  const row = await prisma.friendship.findUnique({
    where: { pairKey: pairKey(viewerId, otherId) },
    select: { id: true, status: true, requesterId: true },
  });
  return relationFromRow(viewerId, row);
}

export function relationFromRow(
  viewerId: string,
  row: { id: string; status: string; requesterId: string } | null,
): RelationInfo {
  if (!row) return { relation: 'none', requestId: null };
  if (row.status === 'ACCEPTED') return { relation: 'friends', requestId: null };
  const sentByViewer = row.requesterId === viewerId;
  if (sentByViewer) return { relation: 'outgoing', requestId: row.id };
  // Declined by the viewer: as if nothing happened, from their side.
  if (row.status === 'DECLINED') return { relation: 'none', requestId: null };
  return { relation: 'incoming', requestId: row.id };
}

/**
 * Username, first name and photo: visible to the user themselves, to anyone they're
 * connected to (friends, or a request in either direction), and to everyone if the user
 * is discoverable.
 */
export async function canSeeBasics(
  prisma: Db,
  viewerId: string,
  ownerId: string,
  relation?: Relation,
) {
  const rel = relation ?? (await getRelation(prisma, viewerId, ownerId)).relation;
  if (rel !== 'none') return true;
  const privacy = await prisma.privacySettings.findUnique({
    where: { userId: ownerId },
    select: { discoverable: true },
  });
  return privacy?.discoverable ?? false;
}

const COLUMN: Record<PrivacyKey, string> = {
  profile: 'profileVisibility',
  activity: 'activityVisibility',
  streaks: 'streaksVisibility',
  achievements: 'achievementsVisibility',
  dashboard: 'dashboardVisibility',
  weight: 'weightVisibility',
};

/** Which sections an owner shares with this viewer. Only accepted friends can get any. */
export async function sharedSections(
  prisma: Db,
  relation: Relation,
  ownerId: string,
): Promise<Record<PrivacyKey, boolean>> {
  const none = {
    profile: false,
    activity: false,
    streaks: false,
    achievements: false,
    dashboard: false,
    weight: false,
  };
  if (relation === 'self')
    return {
      ...none,
      profile: true,
      activity: true,
      streaks: true,
      achievements: true,
      dashboard: true,
      weight: true,
    };
  if (relation !== 'friends') return none;
  const privacy = await prisma.privacySettings.findUnique({ where: { userId: ownerId } });
  if (!privacy) return none;
  const row = privacy as unknown as Record<string, string>;
  return Object.fromEntries(
    (Object.keys(COLUMN) as PrivacyKey[]).map((key) => [key, row[COLUMN[key]] === 'FRIENDS']),
  ) as Record<PrivacyKey, boolean>;
}

/** Ids of accepted friends. */
export async function friendIds(prisma: Db, userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

/** Friends who share a section with the viewer (e.g. everyone whose activity the viewer may see). */
export async function friendsSharing(
  prisma: Db,
  viewerId: string,
  key: 'activity' | 'achievements',
) {
  const ids = await friendIds(prisma, viewerId);
  if (!ids.length) return [];
  const rows = await prisma.privacySettings.findMany({
    where: { userId: { in: ids }, [COLUMN[key]]: 'FRIENDS' },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
