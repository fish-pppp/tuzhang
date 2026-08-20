import { useEffect, useState } from "react";
import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
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

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    void joinGroup({ data: { code, ...profileFromUser(user) } })
      .then(async (group) => {
        if (cancelled) return;
        await queryClient.invalidateQueries({ queryKey: ["groups"] });
        void navigate({ to: "/g/$groupId", params: { groupId: group.id } });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "加入失败");
      });
    return () => {
      cancelled = true;
    };
  }, [code, isPending, navigate, queryClient, user]);

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
