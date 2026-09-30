import { createFileRoute } from "@tanstack/react-router";
import { SpendPage } from "@/components/spend-page";
import { parseDemoFlag } from "@/lib/split/home-group";

export const Route = createFileRoute("/spend")({
  validateSearch: (raw: Record<string, unknown>) => ({
    demo: parseDemoFlag(raw.demo),
    groupId:
      typeof raw.groupId === "string" && raw.groupId.length > 0 && raw.groupId.length <= 80
        ? raw.groupId
        : undefined,
  }),
  head: () => ({
    meta: [{ title: "我的花费 · 途账" }],
  }),
  component: SpendRoute,
});

function SpendRoute() {
  const { demo, groupId } = Route.useSearch();
  return <SpendPage demo={demo} groupId={groupId} />;
}
