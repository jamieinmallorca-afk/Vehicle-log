import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "@/lib/auth";
import { createSessionToken, sessionCookie } from "@/lib/session";
import { findUser } from "@/lib/users";

export const runtime = "nodejs";

// Very small in-memory brute-force limiter: 8 failed attempts per IP per 15 minutes.
const fails = new Map<string, { n: number; first: number }>();
const WINDOW = 15 * 60 * 1000;
const MAX_FAILS = 8;

const sha = (s: string) => createHash("sha256").update(s).digest();

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const rec = fails.get(ip);
  if (rec && Date.now() - rec.first < WINDOW && rec.n >= MAX_FAILS) {
    return redirect("/login?error=locked");
  }

  const form = await req.formData();
  const username = String(form.get("username") || "");
  const password = String(form.get("password") || "");

  const user = findUser(username);
  // Always compare (against a dummy if the user is unknown) to keep timing uniform.
  const ok = timingSafeEqual(sha(password), sha(user ? user.password : "\u0000no-such-user"));

  if (!user || !ok) {
    const now = Date.now();
    if (!rec || now - rec.first >= WINDOW) fails.set(ip, { n: 1, first: now });
    else rec.n++;
    await new Promise((r) => setTimeout(r, 600));
    return redirect("/login?error=1");
  }

  fails.delete(ip);
  const token = await createSessionToken(user.name);
  const res = redirect("/");
  res.headers.append("Set-Cookie", sessionCookie(token));
  return res;
}
