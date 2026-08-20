import { createFileRoute } from "@tanstack/react-router";
import { TripBoard } from "@/components/trip-board";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main>
      <TripBoard />
    </main>
  );
}
