"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCoords } from "@/lib/geo";

type Defaults = { followUpOf: number | null; location: string; geo: string; vehicle: string };

function nowLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function EntryForm({ defaults, recheckDays }: { defaults: Defaults; recheckDays: number }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [when, setWhen] = useState("");
  const [location, setLocation] = useState(defaults.location);
  const [geo, setGeo] = useState(defaults.geo);
  const [vehicle, setVehicle] = useState(defaults.vehicle);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [error, setError] = useState("");

  // Set the default time on the client so it uses the phone's own clock/timezone.
  useEffect(() => setWhen(nowLocalInput()), []);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const coords = parseCoords(geo);

  // NOTE: input.files is a live list — copy it out synchronously BEFORE the input is reset,
  // otherwise React's deferred state update sees an empty list and no photos get attached.
  function onPick(input: HTMLInputElement) {
    const picked = Array.from(input.files ?? []);
    input.value = ""; // allow picking the same photo again
    if (!picked.length) return;
    setFiles((prev) => [...prev, ...picked].slice(0, 12));
  }

  function useGps() {
    setError("");
    if (!navigator.geolocation) return setError("GPS is not available in this browser.");
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        setGpsBusy(false);
      },
      (err) => {
        setGpsBusy(false);
        setError(`Could not get location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!files.length && !notes.trim()) return setError("Add at least one photo or a note.");
    if (!location.trim() && !coords) return setError("Add a location (text, GPS or a Google Maps link).");
    if (geo.trim() && !coords) return setError("Couldn't read those coordinates. Use \"lat, lng\" or a long Google Maps link.");
    const dt = new Date(when);
    if (isNaN(dt.getTime())) return setError("Please set a valid date and time.");

    const fd = new FormData();
    fd.set("occurred_at", dt.toISOString());
    fd.set("location_text", location);
    fd.set("geo", geo);
    fd.set("vehicle", vehicle);
    fd.set("notes", notes);
    if (defaults.followUpOf) fd.set("follow_up_of", String(defaults.followUpOf));
    files.forEach((f) => fd.append("photos", f));

    setBusy(true);
    try {
      const res = await fetch("/api/entries", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {defaults.followUpOf && <div className="card muted">Follow-up to entry #{defaults.followUpOf}. Location and vehicle are pre-filled.</div>}

      <label htmlFor="photos">Photos</label>
      <input id="photos" type="file" accept="image/*" multiple onChange={(e) => onPick(e.target)} />
      <div className="hint">Take or choose photos. You can add more than once.</div>
      {previews.length > 0 && (
        <div className="previews">
          {previews.map((src, i) => (
            <div className="preview" key={src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Photo ${i + 1}`} />
              <button type="button" aria-label="Remove photo" onClick={() => setFiles((f) => f.filter((_, k) => k !== i))}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <label htmlFor="when">Date &amp; time</label>
      <input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
      <div className="hint">Filled in automatically; edit if you saw it earlier. Re-check reminder: {recheckDays} days later.</div>

      <label htmlFor="location">Location</label>
      <input id="location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Street, nearest number, landmark…" />

      <label htmlFor="geo">GPS pin / Google Maps link</label>
      <div className="row">
        <input
          id="geo"
          type="text"
          value={geo}
          onChange={(e) => setGeo(e.target.value)}
          placeholder="39.569600, 2.650200  or  Google Maps link"
          style={{ flex: 1, minWidth: 0 }}
          inputMode="text"
        />
        <button type="button" onClick={useGps} disabled={gpsBusy}>
          {gpsBusy ? "Locating…" : "📍 Use GPS"}
        </button>
      </div>
      <div className="hint">
        {coords ? (
          <>
            Pin OK: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </>
        ) : (
          "Tap “Use GPS” while standing next to the vehicle, or paste a long Google Maps link."
        )}
      </div>

      <label htmlFor="vehicle">Vehicle (optional)</label>
      <input id="vehicle" type="text" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Colour, make/model, plate…" />

      <label htmlFor="notes">Notes</label>
      <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What you observed: facts only (condition, how it is parked, anything notable)…" />

      {error && <div className="error">{error}</div>}

      <p>
        <button className="primary" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Uploading… keep this page open" : "Save entry"}
        </button>
      </p>
    </form>
  );
}
