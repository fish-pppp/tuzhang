import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/home-page";

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>) => ({
    demo: raw.demo === true || raw.demo === "1" || raw.demo === "true" ? true : undefined,
  }),
  component: Home,
});

function Home() {
  const { demo } = Route.useSearch();
  return <HomePage demo={demo} />;
}
