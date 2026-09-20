import { useEffect, useState, type ReactNode } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TripView } from "@/components/trip-board";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { friendlyError, isUnauthorizedError } from "@/lib/errors";
import {
  addGroupExpense,
  leaveGroup,
  loadGroup,
  removeGroupExpense,
  removeGroupMember,
  renameGroup,
  settleGroup,
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
    // Light polling keeps everyone's balances in sync; pause it while the tab
    // is hidden and stop hammering the server once a load has failed (the
    // error view offers a manual retry).
    refetchInterval: (q) => (q.state.error ? false : 5000),
    refetchIntervalInBackground: false,
    retry: (count, err) => !isUnauthorizedError(err) && count < 1,
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
  if (!user || isUnauthorizedError(query.error)) {
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
        {friendlyError(query.error, "打不开这个群组。")}
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="mt-3 text-sm text-primary underline-offset-4 hover:underline"
        >
          重试
        </button>
        <Link
          to="/"
          search={{ demo: undefined }}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
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
        formerMembers={trip.formerMembers}
        onRename={setDraftName}
        onAddExpense={async (input) => {
          await addGroupExpense({
            data: {
              groupId,
              title: input.title,
              amountCents: input.amountCents,
              payerId: input.payerId,
              participantIds: input.participantIds,
              shares: input.shares,
            },
          });
          await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
          await queryClient.invalidateQueries({ queryKey: ["groups"] });
        }}
        onSettle={async () => {
          await settleGroup({ data: { groupId } });
          await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
          await queryClient.invalidateQueries({ queryKey: ["groups"] });
        }}
        onRemoveExpense={async (expenseId, reason) => {
          await removeGroupExpense({ data: { groupId, expenseId, reason } });
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
            void queryClient.invalidateQueries({ queryKey: ["home-group"] });
            void navigate({ to: "/", search: { demo: undefined } });
          });
        }}
        onRemoveMember={async (userId) => {
          await removeGroupMember({ data: { groupId, userId } });
          await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
          await queryClient.invalidateQueries({ queryKey: ["groups"] });
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
