import { getSettingsUncached } from "@/server/services/settings";

// Platzhalter für Paket 2.1 (pg-boss). Prüft hier nur, dass Server-Module beim Start ladbar sind.
export async function startJobs() {
  const s = await getSettingsUncached();
  console.info(`[jobs] bereit (Ladungsfrist ${s.meeting.noticeDays} Tage)`);
}
