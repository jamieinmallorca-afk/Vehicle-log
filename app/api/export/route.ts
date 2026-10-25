import { getCurrentUser, json } from "@/lib/auth";
import { EntryRow, query } from "@/lib/db";
import { buildPdf, PdfEntry } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST form: id (repeated), title, intro, size = full | compact
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const form = await req.formData();
  const ids = [...new Set(form.getAll("id").map((v) => parseInt(String(v), 10)))].filter(Number.isInteger).slice(0, 500);
  if (!ids.length) return json({ error: "Select at least one entry" }, 400);

  const compact = form.get("size") === "compact";
  const title = String(form.get("title") || "").trim().slice(0, 120) || "Vehicle Observation Log";
  const intro = String(form.get("intro") || "").trim().slice(0, 2000);

  const er = await query<EntryRow>(`SELECT * FROM entries WHERE id = ANY($1::int[]) ORDER BY occurred_at ASC, id ASC`, [ids]);
  if (!er.rows.length) return json({ error: "No matching entries" }, 404);

  const col = compact ? "thumb" : "data";
  const pr = await query<{ entry_id: number; img: Buffer; sha256: string }>(
    `SELECT entry_id, ${col} AS img, sha256 FROM photos WHERE entry_id = ANY($1::int[]) ORDER BY position, id`,
    [er.rows.map((e) => e.id)],
  );

  // For follow-ups, look up the date of the entry they refer to.
  const refIds = er.rows.map((e) => e.follow_up_of).filter((v): v is number => v != null);
  const refDates = new Map<number, Date>();
  if (refIds.length) {
    const rr = await query<{ id: number; occurred_at: Date }>(`SELECT id, occurred_at FROM entries WHERE id = ANY($1::int[])`, [refIds]);
    rr.rows.forEach((r) => refDates.set(r.id, r.occurred_at));
  }

  const entries: PdfEntry[] = er.rows.map((e) => ({
    ...e,
    photos: pr.rows.filter((p) => p.entry_id === e.id).map((p) => ({ data: p.img, sha256: p.sha256 })),
    follow_up_date: e.follow_up_of ? refDates.get(e.follow_up_of) ?? null : null,
  }));

  const bytes = await buildPdf({ title, intro, generatedBy: user.name, entries });
  const day = new Date().toISOString().slice(0, 10);

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="vehicle-log-${day}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
