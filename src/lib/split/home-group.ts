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

/** `/?demo=1` stays on the local sample; the router may pass 1 as a number. */
export function parseDemoFlag(value: unknown): true | undefined {
  return value === true || value === 1 || value === "1" || value === "true"
    ? true
    : undefined;
}
