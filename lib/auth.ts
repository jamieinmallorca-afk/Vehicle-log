import { cookies } from "next/headers";
import { COOKIE_NAME, verifySessionToken } from "./session";
import { findUser, isAdmin } from "./users";

export type CurrentUser = { name: string; admin: boolean };

/** Returns the logged-in user, or null. Also rejects users removed from USERS. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const name = await verifySessionToken(jar.get(COOKIE_NAME)?.value);
  if (!name) return null;
  const rec = findUser(name);
  if (!rec) return null;
  return { name: rec.name, admin: isAdmin(rec.name) };
}

/** Plain-JSON error helper for route handlers. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Relative redirect (avoids wrong-host issues behind Railway's proxy). */
export function redirect(path: string, status = 303): Response {
  return new Response(null, { status, headers: { Location: path } });
}
