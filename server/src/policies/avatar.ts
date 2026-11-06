/**
 * Who may see a profile picture. For now only its owner; phase 5 adds friends and,
 * for discoverable users, search results.
 */
export async function canViewAvatar(viewerId: string, ownerId: string): Promise<boolean> {
  return viewerId === ownerId;
}
