import { getCurrentUser, json } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

// Photos are only ever served through this authenticated route (never from a public URL).
// ?thumb=1 returns the small version.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const id = parseInt((await params).id, 10);
  if (!Number.isInteger(id)) return json({ error: "Bad id" }, 400);

  const thumb = new URL(req.url).searchParams.get("thumb") === "1";
  const r = await query<{ img: Buffer; mime: string }>(
    `SELECT ${thumb ? "thumb" : "data"} AS img, mime FROM photos WHERE id = $1`,
    [id],
  );
  if (!r.rows.length) return json({ error: "Not found" }, 404);

  return new Response(new Uint8Array(r.rows[0].img), {
    headers: {
      "Content-Type": r.rows[0].mime,
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
