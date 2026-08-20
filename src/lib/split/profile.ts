import type { AppUser } from "@/lib/auth/use-current-user";

export function profileFromUser(user: AppUser | null) {
  const displayName =
    user?.displayName?.trim() ||
    user?.primaryEmail?.split("@")[0] ||
    "途友";
  return {
    displayName,
    avatarUrl: user?.profileImageUrl ?? null,
  };
}
