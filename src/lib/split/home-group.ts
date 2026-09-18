/** Default ledger name when the user has no display name yet. */
export const DEFAULT_HOME_GROUP_NAME = "我的账本";

/** Name for the auto-created home group (`{名字}的账本`). */
export function homeGroupName(displayName: string | null | undefined): string {
  const name = displayName?.trim().replace(/\s+/g, " ") ?? "";
  if (!name) return DEFAULT_HOME_GROUP_NAME;
  return `${name.slice(0, 20)}的账本`;
}

/** Latest group this user created (lists are already newest-first). */
export function pickHomeGroup<T extends { createdBy: string }>(
  groups: T[],
  userId: string,
): T | undefined {
  return groups.find((g) => g.createdBy === userId);
}
