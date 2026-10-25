import { getCurrentUser, json } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

const ics = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Calendar file so the re-check shows up as a reminder on the phone's own calendar.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const id = parseInt((await params).id, 10);
  const r = await query(`SELECT id, location_text, vehicle, recheck_due_at FROM entries WHERE id = $1`, [id]);
  if (!r.rows.length) return json({ error: "Not found" }, 404);
  const e = r.rows[0];

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const start = new Date(e.recheck_due_at);
  const end = new Date(start.getTime() + 15 * 60 * 1000);

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vehicle Log//EN",
    "BEGIN:VEVENT",
    `UID:vehicle-log-${e.id}@${host || "local"}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${ics(`Re-check parked vehicle (entry #${e.id})`)}`,
    `DESCRIPTION:${ics(`${e.vehicle ? e.vehicle + " - " : ""}${e.location_text}\n${proto}://${host}/entries/${e.id}`)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Re-check parked vehicle",
    "TRIGGER:-PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="recheck-${e.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
