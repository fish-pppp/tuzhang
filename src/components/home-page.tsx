import type { ReactNode } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TripBoard } from "@/components/trip-board";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { friendlyError, isUnauthorizedError } from "@/lib/errors";
import { ensureMyHomeGroup } from "@/lib/split/group-api";

function Status({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted">
      {children}
    </main>
  );
}

/** Signed-in visitors land on a group they created; guests still see the demo. */
export function HomePage({ demo }: { demo?: boolean }) {
  const { user, isPending } = useCurrentUserState();
  const homeQuery = useQuery({
    queryKey: ["home-group"],
    queryFn: () => ensureMyHomeGroup(),
    enabled: Boolean(user) && !demo,
    staleTime: 30_000,
    retry: (count, err) => !isUnauthorizedError(err) && count < 1,
  });

  if (isPending) {
    return <Status>正在确认登录…</Status>;
  }

  if (user && !demo) {
    if (homeQuery.data?.id) {
      return (
        <Navigate to="/g/$groupId" params={{ groupId: homeQuery.data.id }} />
      );
    }
    if (homeQuery.isPending) {
      return <Status>正在打开你的账本…</Status>;
    }
    return (
      <Status>
        {friendlyError(homeQuery.error, "打不开你的账本。")}
        <button
          type="button"
          onClick={() => void homeQuery.refetch()}
          className="mt-3 text-sm text-primary underline-offset-4 hover:underline"
        >
          重试
        </button>
        <Link
          to="/"
          search={{ demo: true }}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          先看示例
        </Link>
      </Status>
    );
  }

  return (
    <main>
      <TripBoard />
    </main>
  );
}
