import EntryForm from "@/components/EntryForm";
import { query, RECHECK_DAYS } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewEntry({ searchParams }: { searchParams: Promise<{ followup?: string }> }) {
  const { followup } = await searchParams;
  const fid = parseInt(followup || "", 10);

  let defaults = { followUpOf: null as number | null, location: "", geo: "", vehicle: "" };
  if (Number.isInteger(fid)) {
    const r = await query(`SELECT id, location_text, lat, lng, vehicle FROM entries WHERE id = $1`, [fid]);
    if (r.rows.length) {
      const e = r.rows[0];
      defaults = {
        followUpOf: e.id,
        location: e.location_text,
        geo: e.lat != null && e.lng != null ? `${Number(e.lat).toFixed(6)}, ${Number(e.lng).toFixed(6)}` : "",
        vehicle: e.vehicle,
      };
    }
  }

  return (
    <>
      <h1>{defaults.followUpOf ? "Follow-up entry" : "New entry"}</h1>
      <EntryForm defaults={defaults} recheckDays={RECHECK_DAYS} />
    </>
  );
}
