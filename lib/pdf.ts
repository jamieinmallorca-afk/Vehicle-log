import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { EntryRow } from "./db";
import { fmtDate, fmtDateTimeTz, mapsUrl } from "./format";

export type PdfPhoto = { data: Buffer; sha256: string };
export type PdfEntry = EntryRow & { photos: PdfPhoto[]; follow_up_date: Date | null };

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 48; // margin
const CW = PAGE_W - M * 2; // content width
const FOOTER = 36;
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT = rgb(0.8, 0.8, 0.8);
const BLACK = rgb(0, 0, 0);

/** Standard PDF fonts only cover WinAnsi (Latin-1 + a few). Replace anything else with "?". */
function makeSanitizer(font: PDFFont) {
  const cache = new Map<string, string>();
  return (text: string): string => {
    let out = "";
    for (const ch of (text || "").normalize("NFC").replace(/\t/g, " ")) {
      if (ch === "\n") {
        out += ch;
        continue;
      }
      let r = cache.get(ch);
      if (r === undefined) {
        try {
          font.encodeText(ch);
          r = ch;
        } catch {
          r = "?";
        }
        cache.set(ch, r);
      }
      out += r;
    }
    return out;
  };
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxW) {
        line = test;
        continue;
      }
      if (line) out.push(line);
      line = "";
      if (font.widthOfTextAtSize(word, size) <= maxW) {
        line = word;
      } else {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxW) {
            out.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      }
    }
    out.push(line);
  }
  return out;
}

export async function buildPdf(opts: {
  title: string;
  intro: string;
  generatedBy: string;
  entries: PdfEntry[]; // already sorted oldest -> newest
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = makeSanitizer(font);

  const { entries } = opts;
  const title = clean(opts.title || "Vehicle Observation Log").slice(0, 120);
  pdf.setTitle(title);
  pdf.setCreator("Vehicle Log");
  pdf.setProducer("Vehicle Log (pdf-lib)");
  pdf.setCreationDate(new Date());

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  const ensure = (h: number) => {
    if (y - h < M + FOOTER) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - M;
    }
  };

  const text = (s: string, x: number, size: number, f: PDFFont = font, color = BLACK) =>
    page.drawText(s, { x, y, size, font: f, color });

  const paragraph = (s: string, size: number, lead: number, f: PDFFont = font, color = BLACK, indent = 0) => {
    for (const line of wrap(clean(s), f, size, CW - indent)) {
      ensure(lead);
      y -= lead;
      if (line) text(line, M + indent, size, f, color);
    }
  };

  const rule = (color = LIGHT) => {
    page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.6, color });
  };

  // ---- Cover block -------------------------------------------------------
  y -= 22;
  text(title, M, 20, bold);
  y -= 8;

  const photoCount = entries.reduce((n, e) => n + e.photos.length, 0);
  const first = entries[0]?.occurred_at;
  const last = entries[entries.length - 1]?.occurred_at;
  const period = first && last ? (fmtDate(first) === fmtDate(last) ? fmtDate(first) : `${fmtDate(first)} - ${fmtDate(last)}`) : "-";

  paragraph(`Period covered: ${period}`, 10.5, 15, font, GRAY);
  paragraph(`Entries: ${entries.length}    Photographs: ${photoCount}`, 10.5, 15, font, GRAY);
  paragraph(`Compiled: ${fmtDateTimeTz(new Date())} by ${opts.generatedBy}`, 10.5, 15, font, GRAY);
  y -= 6;
  if (opts.intro.trim()) {
    paragraph(opts.intro.trim(), 10.5, 14.5);
    y -= 4;
  }
  paragraph(
    "Entries are listed in chronological order. \"Recorded\" is the automatic server timestamp of when the entry was " +
      "created; the observation time is entered by the observer. Photo hashes (SHA-256) allow later verification " +
      "that the stored images have not been altered.",
    8.5,
    12,
    font,
    GRAY,
  );
  y -= 6;
  rule(BLACK);
  y -= 10;

  // ---- Entries -----------------------------------------------------------
  const field = (label: string, value: string) => {
    if (!value.trim()) return;
    const lines = wrap(clean(value), font, 10, CW - 78);
    lines.forEach((line, i) => {
      ensure(14);
      y -= 14;
      if (i === 0) text(label, M, 9.5, bold, GRAY);
      if (line) text(line, M + 78, 10);
    });
  };

  const GAP = 12;
  const colW = (CW - GAP) / 2;
  const maxImgH = 250;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    ensure(150);

    y -= 6;
    text(`Entry ${i + 1} of ${entries.length}`, M, 12.5, bold);
    const when = clean(fmtDateTimeTz(e.occurred_at));
    text(when, PAGE_W - M - bold.widthOfTextAtSize(when, 11), 11, bold);
    y -= 3;

    field("Location", e.location_text);
    if (e.lat != null && e.lng != null) {
      field("GPS", `${e.lat.toFixed(6)}, ${e.lng.toFixed(6)}`);
      field("Map", mapsUrl(e.lat, e.lng));
    }
    field("Vehicle", e.vehicle);
    field("Notes", e.notes);
    if (e.follow_up_date) field("Follow-up", `Re-check of an earlier entry recorded ${fmtDate(e.follow_up_date)}`);
    field("Recorded", `${fmtDateTimeTz(e.created_at)} by ${e.created_by} (ref #${e.id})`);

    // Photos in a 2-column grid
    if (e.photos.length) y -= 8;
    for (let p = 0; p < e.photos.length; p += 2) {
      const row = e.photos.slice(p, p + 2);
      const embedded = await Promise.all(row.map((ph) => pdf.embedJpg(ph.data)));
      const sized = embedded.map((img) => {
        const s = Math.min(colW / img.width, maxImgH / img.height, 1.5);
        return { img, w: img.width * s, h: img.height * s };
      });
      const rowH = Math.max(...sized.map((s) => s.h)) + 14;
      ensure(rowH + 4);
      const top = y;
      sized.forEach((s, k) => {
        const x = M + k * (colW + GAP);
        page.drawImage(s.img, { x, y: top - s.h, width: s.w, height: s.h });
        page.drawRectangle({ x, y: top - s.h, width: s.w, height: s.h, borderColor: LIGHT, borderWidth: 0.5 });
        page.drawText(`Photo ${p + k + 1} of ${e.photos.length}  |  SHA-256 ${row[k].sha256}`, {
          x,
          y: top - s.h - 9,
          size: 5.6,
          font,
          color: GRAY,
        });
      });
      y = top - rowH;
    }

    y -= 8;
    if (i < entries.length - 1) {
      ensure(12);
      rule();
      y -= 8;
    }
  }

  // ---- Footers -----------------------------------------------------------
  const pages = pdf.getPages();
  pages.forEach((pg, idx) => {
    pg.drawLine({ start: { x: M, y: M + 14 }, end: { x: PAGE_W - M, y: M + 14 }, thickness: 0.4, color: LIGHT });
    pg.drawText(title.slice(0, 70) + "  |  Confidential", { x: M, y: M, size: 8, font, color: GRAY });
    const label = `Page ${idx + 1} of ${pages.length}`;
    pg.drawText(label, { x: PAGE_W - M - font.widthOfTextAtSize(label, 8), y: M, size: 8, font, color: GRAY });
  });

  return pdf.save();
}
