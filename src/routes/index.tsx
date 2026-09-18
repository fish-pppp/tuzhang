import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/home-page";
import { parseDemoFlag } from "@/lib/split/home-group";

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>) => ({
    demo: parseDemoFlag(raw.demo),
  }),
  component: Home,
});

function Home() {
  const { demo } = Route.useSearch();
  return <HomePage demo={demo} />;
}
