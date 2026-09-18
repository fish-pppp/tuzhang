import { ensureMyHomeGroup } from "./group-api";

/** True when login should land on the user's own group instead of a deep link. */
export function isDefaultHomeRedirect(path: string | undefined): path is undefined | "/" {
  return !path || path === "/";
}

/** After sign-in: honor `?redirect=` deep links, otherwise open the home group. */
export async function resolvePostLoginPath(explicit?: string): Promise<string> {
  if (!isDefaultHomeRedirect(explicit) && explicit.startsWith("/")) {
    return explicit;
  }
  try {
    const home = await ensureMyHomeGroup();
    return `/g/${home.id}`;
  } catch {
    return "/";
  }
}
