// Pure helper (safe on client and server): accepts "39.5696, 2.6502" or a long Google Maps URL.

export type LatLng = { lat: number; lng: number };

function valid(lat: number, lng: number): LatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function parseCoords(input: string | null | undefined): LatLng | null {
  if (!input) return null;
  const s = decodeURIComponent(input.trim());
  const num = "(-?\\d{1,3}(?:\\.\\d+)?)";
  const patterns = [
    new RegExp(`^${num}\\s*[,;\\s]\\s*${num}$`), // plain "lat, lng"
    new RegExp(`@${num},${num}`), // .../@39.57,2.65,17z
    new RegExp(`!3d${num}!4d${num}`), // data=!3d39.57!4d2.65
    new RegExp(`[?&](?:q|ll|query|center)=${num}(?:,|%2C)${num}`), // ?q=39.57,2.65
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const r = valid(parseFloat(m[1]), parseFloat(m[2]));
      if (r) return r;
    }
  }
  return null;
}
