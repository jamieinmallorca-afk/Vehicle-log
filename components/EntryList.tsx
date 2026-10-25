"use client";

import Link from "next/link";
import { useState } from "react";

export type ListEntry = {
  id: number;
  when: string;
  location: string;
  vehicle: string;
  notes: string;
  by: string;
  photoCount: number;
  coverId: number | null;
  badge: { text: string; due: boolean };
};

export default function EntryList({ entries }: { entries: ListEntry[] }) {
  const [sel, setSel] = useState<Set<number>>(new Set());

  const toggle = (id: number) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    // Plain HTML form POST -> opens the PDF in a new tab. No JS needed for the export itself.
    <form method="post" action="/api/export" target="_blank">
      <div className="row" style={{ marginBottom: 10 }}>
        <button type="button" className="small" onClick={() => setSel(new Set(entries.map((e) => e.id)))}>
          Select all
        </button>
        <button type="button" className="small" onClick={() => setSel(new Set())} disabled={sel.size === 0}>
          Clear
        </button>
        <span className="muted">{sel.size} selected</span>
      </div>

      {entries.map((e) => (
        <div className="card entry" key={e.id}>
          <input
            type="checkbox"
            name="id"
            value={e.id}
            checked={sel.has(e.id)}
            onChange={() => toggle(e.id)}
            aria-label={`Select entry ${e.id}`}
          />
          <Link href={`/entries/${e.id}`} className="entry-link">
            {e.coverId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="thumb" src={`/api/photos/${e.coverId}?thumb=1`} alt="" loading="lazy" />
            ) : (
              <div className="thumb empty">no photo</div>
            )}
            <div className="entry-body">
              <div className="entry-when">{e.when}</div>
              {e.vehicle && <div>{e.vehicle}</div>}
              <div className="entry-loc muted">{e.location}</div>
              {e.notes && <div className="muted">{e.notes}</div>}
              <div style={{ marginTop: 4 }}>
                <span className={`badge${e.badge.due ? " due" : ""}`}>{e.badge.text}</span>
                <span className="badge">
                  {e.photoCount} photo{e.photoCount === 1 ? "" : "s"}
                </span>
                <span className="badge">{e.by}</span>
              </div>
            </div>
          </Link>
        </div>
      ))}

      <div className="exportbar">
        <div className="exportbar-in">
          <details>
            <summary>PDF options</summary>
            <label htmlFor="title">Title</label>
            <input id="title" name="title" type="text" defaultValue="Vehicle Observation Log" />
            <label htmlFor="intro">Cover note (optional)</label>
            <textarea id="intro" name="intro" style={{ minHeight: 70 }} placeholder="e.g. Reference number, who this is for, short summary" />
            <label>Photo size</label>
            <div className="row">
              <label style={{ fontWeight: 400, margin: 0 }}>
                <input type="radio" name="size" value="full" defaultChecked /> Full quality
              </label>
              <label style={{ fontWeight: 400, margin: 0 }}>
                <input type="radio" name="size" value="compact" /> Compact (smaller file)
              </label>
            </div>
          </details>
          <button type="submit" className="primary" disabled={sel.size === 0} style={{ width: "100%" }}>
            Export PDF ({sel.size})
          </button>
        </div>
      </div>
    </form>
  );
}
