import { getCurrentUser, json } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

// Delete an entry (and its photos). Allowed for the author or the admin.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const id = parseInt((await params).id, 10);
  if (!Number.isInteger(id)) return json({ error: "Bad id" }, 400);

  const r = await query<{ created_by: string }>(`SELECT created_by FROM entries WHERE id = $1`, [id]);
  if (!r.rows.length) return json({ error: "Not found" }, 404);
  if (!user.admin && r.rows[0].created_by.toLowerCase() !== user.name.toLowerCase()) {
    return json({ error: "Only the author or admin can delete this entry" }, 403);
  }

  await query(`DELETE FROM entries WHERE id = $1`, [id]);
  return json({ ok: true });
}
