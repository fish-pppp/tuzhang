import { useEffect, useState } from "react";
import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { friendlyError } from "@/lib/errors";
import { joinGroup } from "@/lib/split/group-api";
import { profileFromUser } from "@/lib/split/profile";

export const Route = createFileRoute("/join/$code")({
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  // `user` is a new object each render; depend on its primitive fields so a
  // re-render can't fire a second joinGroup for the same person.
  const userId = user?.id ?? null;
  const { displayName, avatarUrl } = profileFromUser(user);

  useEffect(() => {
    if (isPending || !userId) return;
    let cancelled = false;
    void joinGroup({ data: { code, displayName, avatarUrl } })
      .then(async (group) => {
        if (cancelled) return;
        await queryClient.invalidateQueries({ queryKey: ["groups"] });
        void navigate({ to: "/g/$groupId", params: { groupId: group.id } });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(friendlyError(err, "加入失败"));
      });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl, code, displayName, isPending, navigate, queryClient, userId]);

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-sm text-muted">
        正在确认登录…
      </main>
    );
  }

  if (!user) {
    return (
      <Navigate to="/login" search={{ redirect: `/join/${code}` }} />
    );
  }

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-sm text-owe">{error}</p>
          <Link
            to="/"
            search={{ demo: undefined }}
            className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            回首页
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6 text-sm text-muted">
      正在加入群组…
    </main>
  );
}
