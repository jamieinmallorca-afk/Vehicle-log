import { getCurrentUser, json } from "@/lib/auth";
import { RECHECK_DAYS, withTransaction } from "@/lib/db";
import { parseCoords } from "@/lib/geo";
import { processImage, ProcessedImage } from "@/lib/images";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILES = 12;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const form = await req.formData();
  const str = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max);

  const occurred = new Date(str("occurred_at", 40));
  if (isNaN(occurred.getTime())) return json({ error: "Invalid date/time" }, 400);

  const locationText = str("location_text", 500);
  const coords = parseCoords(str("geo", 600));
  const vehicle = str("vehicle", 300);
  const notes = str("notes", 5000);
  const followUpRaw = parseInt(str("follow_up_of", 12), 10);
  const followUpOf = Number.isInteger(followUpRaw) && followUpRaw > 0 ? followUpRaw : null;

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_FILES) return json({ error: `Maximum ${MAX_FILES} photos per entry` }, 400);
  if (!files.length && !notes) return json({ error: "Add at least one photo or a note" }, 400);
  if (!locationText && !coords) return json({ error: "Add a location (text or GPS)" }, 400);

  // Process images before touching the DB.
  const processed: ProcessedImage[] = [];
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) return json({ error: `${f.name || "A photo"} is too large (max 25 MB)` }, 400);
    try {
      processed.push(await processImage(Buffer.from(await f.arrayBuffer())));
    } catch {
      return json({ error: `${f.name || "A file"} is not a readable image (use JPEG, PNG or WebP)` }, 400);
    }
  }

  const id = await withTransaction(async (c) => {
    const r = await c.query<{ id: number }>(
      `INSERT INTO entries
         (created_by, occurred_at, location_text, lat, lng, vehicle, notes, recheck_due_at, follow_up_of)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $2::timestamptz + make_interval(days => $8),
               (SELECT id FROM entries WHERE id = $9))
       RETURNING id`,
      [user.name, occurred.toISOString(), locationText, coords?.lat ?? null, coords?.lng ?? null, vehicle, notes, RECHECK_DAYS, followUpOf],
    );
    const entryId = r.rows[0].id;

    for (let i = 0; i < processed.length; i++) {
      const p = processed[i];
      await c.query(
        `INSERT INTO photos (entry_id, position, mime, data, thumb, sha256) VALUES ($1, $2, 'image/jpeg', $3, $4, $5)`,
        [entryId, i, p.data, p.thumb, p.sha256],
      );
    }

    // A follow-up closes the reminder on the entry it follows.
    if (followUpOf) {
      await c.query(`UPDATE entries SET recheck_done_at = now() WHERE id = $1 AND recheck_done_at IS NULL`, [followUpOf]);
    }
    return entryId;
  });

  return json({ id }, 201);
}
