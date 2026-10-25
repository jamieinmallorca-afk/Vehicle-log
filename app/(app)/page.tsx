import Link from "next/link";
import { query } from "@/lib/db";
import { fmtDate, fmtDateTime } from "@/lib/format";
import EntryList, { ListEntry } from "@/components/EntryList";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  created_by: string;
  occurred_at: Date;
  location_text: string;
  vehicle: string;
  notes: string;
  lat: number | null;
  lng: number | null;
  recheck_due_at: Date;
  recheck_done_at: Date | null;
  photo_count: number;
  cover_id: number | null;
};

export default async function Dashboard() {
  const { rows } = await query<Row>(
    `SELECT e.id, e.created_by, e.occurred_at, e.location_text, e.vehicle, e.notes, e.lat, e.lng,
            e.recheck_due_at, e.recheck_done_at,
            (SELECT count(*) FROM photos p WHERE p.entry_id = e.id)::int AS photo_count,
            (SELECT id FROM photos p WHERE p.entry_id = e.id ORDER BY position, id LIMIT 1) AS cover_id
       FROM entries e
      ORDER BY e.occurred_at DESC, e.id DESC`,
  );

  const now = Date.now();
  const due = rows.filter((r) => !r.recheck_done_at && new Date(r.recheck_due_at).getTime() <= now);

  const entries: ListEntry[] = rows.map((r) => {
    const isDue = !r.recheck_done_at && new Date(r.recheck_due_at).getTime() <= now;
    return {
      id: r.id,
      when: fmtDateTime(r.occurred_at),
      location: r.location_text || (r.lat != null ? `${r.lat.toFixed(5)}, ${r.lng?.toFixed(5)}` : ""),
      vehicle: r.vehicle,
      notes: r.notes.length > 140 ? r.notes.slice(0, 140) + "…" : r.notes,
      by: r.created_by,
      photoCount: r.photo_count,
      coverId: r.cover_id,
      badge: isDue
        ? { text: "Re-check due", due: true }
        : r.recheck_done_at
          ? { text: "Re-checked", due: false }
          : { text: `Re-check ${fmtDate(r.recheck_due_at)}`, due: false },
    };
  });

  return (
    <>
      {due.length > 0 && (
        <section className="banner">
          <h2>
            {due.length === 1 ? "1 vehicle to re-check" : `${due.length} vehicles to re-check`}
          </h2>
          {due.map((r) => (
            <div className="item" key={r.id}>
              <div>
                <strong>{r.vehicle || r.location_text || `Entry #${r.id}`}</strong>
                <div className="muted">
                  {r.vehicle && r.location_text ? `${r.location_text} · ` : ""}first logged {fmtDate(r.occurred_at)}
                </div>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <Link className="btn primary small" href={`/new?followup=${r.id}`}>
                  Still there – add update
                </Link>
                <form method="post" action={`/api/entries/${r.id}/recheck`}>
                  <button className="small" type="submit">
                    Gone / dismiss
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      <h1>Entries</h1>
      {entries.length === 0 ? (
        <div className="card">
          <p>No entries yet.</p>
          <Link className="btn primary" href="/new">
            + Add the first entry
          </Link>
        </div>
      ) : (
        <EntryList entries={entries} />
      )}
    </>
  );
}
