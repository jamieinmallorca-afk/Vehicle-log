import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { EntryRow, query } from "@/lib/db";
import { fmtDate, fmtDateTime, mapsUrl } from "@/lib/format";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseInt((await params).id, 10);
  if (!Number.isInteger(id)) notFound();

  const user = await getCurrentUser();
  const er = await query<EntryRow>(`SELECT * FROM entries WHERE id = $1`, [id]);
  if (!er.rows.length) notFound();
  const e = er.rows[0];

  const pr = await query<{ id: number }>(`SELECT id FROM photos WHERE entry_id = $1 ORDER BY position, id`, [id]);
  const canDelete = !!user && (user.admin || user.name.toLowerCase() === e.created_by.toLowerCase());
  const isDue = !e.recheck_done_at && new Date(e.recheck_due_at).getTime() <= Date.now();

  return (
    <>
      <p>
        <Link href="/">← All entries</Link>
      </p>
      <h1>{fmtDateTime(e.occurred_at)}</h1>

      {pr.rows.length > 0 && (
        <div className="photos" style={{ marginBottom: 14 }}>
          {pr.rows.map((p) => (
            <a key={p.id} href={`/api/photos/${p.id}`} target="_blank">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${p.id}?thumb=1`} alt="" loading="lazy" />
            </a>
          ))}
        </div>
      )}

      <div className="card">
        <dl className="meta">
          <dt>Location</dt>
          <dd>{e.location_text || "—"}</dd>
          {e.lat != null && e.lng != null && (
            <>
              <dt>GPS</dt>
              <dd>
                {e.lat.toFixed(6)}, {e.lng.toFixed(6)} ·{" "}
                <a href={mapsUrl(e.lat, e.lng)} target="_blank" rel="noreferrer noopener">
                  Open in Google Maps
                </a>
              </dd>
            </>
          )}
          {e.vehicle && (
            <>
              <dt>Vehicle</dt>
              <dd>{e.vehicle}</dd>
            </>
          )}
          <dt>Notes</dt>
          <dd>{e.notes || "—"}</dd>
          <dt>Recorded</dt>
          <dd>
            {fmtDateTime(e.created_at)} by {e.created_by}
          </dd>
          <dt>Re-check</dt>
          <dd>
            {e.recheck_done_at
              ? `Done ${fmtDate(e.recheck_done_at)}`
              : isDue
                ? "Due now"
                : `Due ${fmtDate(e.recheck_due_at)}`}
            {e.follow_up_of ? (
              <>
                {" · "}
                <Link href={`/entries/${e.follow_up_of}`}>follow-up of #{e.follow_up_of}</Link>
              </>
            ) : null}
          </dd>
        </dl>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <Link className="btn primary" href={`/new?followup=${e.id}`}>
          Add follow-up
        </Link>
        <a className="btn" href={`/api/entries/${e.id}/reminder`}>
          Add re-check to calendar
        </a>
        {!e.recheck_done_at && (
          <form method="post" action={`/api/entries/${e.id}/recheck`}>
            <button type="submit">Dismiss reminder</button>
          </form>
        )}
        <span className="spacer" />
        {canDelete && <DeleteButton id={e.id} />}
      </div>
    </>
  );
}
