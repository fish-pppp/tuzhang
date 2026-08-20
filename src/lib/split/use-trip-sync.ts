import { useEffect, useRef } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadSavedTrip, saveTrip } from "./api";
import { useTripStore } from "./store";

function isUnauthorized(err: unknown) {
  return err instanceof Error && err.message === "Unauthorized";
}

export function useTripSync() {
  const { user, isPending } = useCurrentUserState();
  const hydrated = useTripStore((s) => s.hydrated);
  const trip = useTripStore((s) => s.trip);
  const replaceTrip = useTripStore((s) => s.replaceTrip);
  const pulled = useRef(false);
  const skipNext = useRef(false);

  useEffect(() => {
    if (isPending || !hydrated || !user || pulled.current) return;
    pulled.current = true;
    void loadSavedTrip()
      .then((saved) => {
        if (saved) {
          skipNext.current = true;
          replaceTrip(saved);
        } else {
          const current = useTripStore.getState().trip;
          void saveTrip({
            data: { name: current.name, payload: JSON.stringify(current) },
          }).catch(() => {});
        }
      })
      .catch((err) => {
        if (!isUnauthorized(err)) {
          console.warn("load trip failed", err);
        }
      });
  }, [hydrated, isPending, replaceTrip, user]);

  useEffect(() => {
    if (!user || !hydrated || !pulled.current) return;
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      void saveTrip({
        data: { name: trip.name, payload: JSON.stringify(trip) },
      }).catch((err) => {
        if (!isUnauthorized(err)) {
          console.warn("save trip failed", err);
        }
      });
    }, 600);
    return () => window.clearTimeout(handle);
  }, [hydrated, trip, user]);
}
