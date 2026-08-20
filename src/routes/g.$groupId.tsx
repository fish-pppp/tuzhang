import { useEffect, useState, type ReactNode } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TripView } from "@/components/trip-board";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  addGroupExpense,
  leaveGroup,
  loadGroup,
  removeGroupExpense,
  renameGroup,
  updateMyName,
} from "@/lib/split/group-api";

export const Route = createFileRoute("/g/$groupId")({
  component: GroupPage,
});

function GroupPage() {
  const { groupId } = Route.useParams();
  const { user, isPending: authPending } = useCurrentUserState();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => loadGroup({ data: { groupId } }),
    enabled: Boolean(user) && !authPending,
    refetchInterval: 5000,
  });

  const trip = query.data;
  const [draftName, setDraftName] = useState(trip?.name ?? "");

  useEffect(() => {
    if (trip?.name) setDraftName(trip.name);
  }, [trip?.name]);

  useEffect(() => {
    if (!trip || draftName.trim() === trip.name || !draftName.trim()) return;
    const handle = window.setTimeout(() => {
      void renameGroup({ data: { groupId, name: draftName.trim() } }).then(() =>
        queryClient.invalidateQueries({ queryKey: ["group", groupId] }),
      );
    }, 700);
    return () => window.clearTimeout(handle);
  }, [draftName, groupId, queryClient, trip]);

  if (authPending) {
    return <PageShell>正在确认登录…</PageShell>;
  }
  if (!user) {
    return (
      <PageShell>
        这个群组需要登录后才能进入。
        <Link
          to="/login"
          search={{ redirect: `/g/${groupId}` }}
          className="mt-3 text-sm text-primary underline-offset-4 hover:underline"
        >
          去登录
        </Link>
      </PageShell>
    );
  }
  if (query.isPending) {
    return <PageShell>正在打开群组…</PageShell>;
  }
  if (query.error || !trip) {
    return (
      <PageShell>
        {query.error instanceof Error ? query.error.message : "打不开这个群组。"}
        <Link to="/" className="mt-3 text-sm text-primary underline-offset-4 hover:underline">
          回首页
        </Link>
      </PageShell>
    );
  }

  return (
    <main>
      <TripView
        trip={{ ...trip, name: draftName || trip.name }}
        meId={user.id}
        variant="group"
        inviteCode={trip.inviteCode}
        groupId={groupId}
        createdBy={trip.createdBy}
        onRename={setDraftName}
        onAddExpense={async (input) => {
          await addGroupExpense({
            data: {
              groupId,
              title: input.title,
              amountCents: input.amountCents,
              payerId: input.payerId,
              participantIds: input.participantIds,
            },
          });
          await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
          await queryClient.invalidateQueries({ queryKey: ["groups"] });
        }}
        onRemoveExpense={async (expenseId) => {
          await removeGroupExpense({ data: { groupId, expenseId } });
          await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
          await queryClient.invalidateQueries({ queryKey: ["groups"] });
        }}
        onUpdateMyName={async (displayName) => {
          await updateMyName({ data: { groupId, displayName } });
          await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
        }}
        onLeave={() => {
          void leaveGroup({ data: { groupId } }).then(() => {
            void queryClient.invalidateQueries({ queryKey: ["groups"] });
            void navigate({ to: "/" });
          });
        }}
      />
    </main>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted">
      {children}
    </main>
  );
}
