import "server-only";

// OV-Stammdaten für Vorlagen (Platzhalter ov.*). Paket 1.6 macht sie in den Einstellungen änderbar.
export const OV_DEFAULTS = {
  name: "Seckenheim-Friedrichsfeld",
  nameLang: "CDU Mannheim-Süd / Seckenheim-Friedrichsfeld",
  nameAnschrift: "CDU OV Mannheim-Süd Seckenheim-Friedrichsfeld",
  ort: "Mannheim",
  absenderzeile: "",
};

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function ovContext() {
  return { ...OV_DEFAULTS, appUrl: appUrl() };
}
