// iCalendar (RFC 5545) für das Kalender-Abo je Nutzer (SPEC.md 3.7).

export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string;
  description?: string;
  url?: string;
  cancelled?: boolean;
  updated?: Date;
};

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Zeilen nach 75 Oktetten falten (UTF-8-sicher). */
export function foldLine(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74; // Folgezeilen beginnen mit einem Leerzeichen
    if (bytes.encode(cur + ch).length > limit) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(name: string, events: IcsEvent[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CDU Seckenheim-Friedrichsfeld//OV-Management//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(name)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${utc(e.updated ?? now)}`,
      `DTSTART:${utc(e.start)}`,
      `DTEND:${utc(e.end)}`,
      `SUMMARY:${escapeIcs(e.summary)}`,
    );
    if (e.location) lines.push(`LOCATION:${escapeIcs(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeIcs(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push(`STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
