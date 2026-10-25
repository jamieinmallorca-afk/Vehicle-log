import { getCurrentUser, redirect } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

// "Gone / dismiss" button on the re-check banner: marks the reminder as handled.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return redirect("/login");

  const id = parseInt((await params).id, 10);
  if (Number.isInteger(id)) {
    await query(`UPDATE entries SET recheck_done_at = now() WHERE id = $1 AND recheck_done_at IS NULL`, [id]);
  }

  // Go back where the user came from (same-origin relative path only).
  let back = "/";
  try {
    const ref = req.headers.get("referer");
    if (ref) {
      const u = new URL(ref);
      back = u.pathname + u.search;
    }
  } catch {}
  return redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/");
}
