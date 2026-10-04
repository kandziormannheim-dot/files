import "server-only";
import { getSettings } from "./services/settings";

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Platzhalter ov.* für Vorlagen (aus den Einstellungen). */
export async function ovContext() {
  const s = await getSettings();
  const { chairUserId: _c, deputyUserId: _d, ...ov } = s.ov;
  return { ...ov, appUrl: appUrl() };
}
