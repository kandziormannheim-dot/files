// Läuft einmal beim Start des Next-Servers (nicht beim Build).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrap } = await import("./server/bootstrap");
  await bootstrap();
  const { startJobs } = await import("./server/jobs/runner");
  await startJobs();
  // Videoschnitt: beim Neustart unterbrochene Aufträge fortsetzen
  const { resumeInterruptedJobs } = await import("./server/services/video");
  const resumed = await resumeInterruptedJobs().catch((err) => (console.error("[video] Fortsetzen fehlgeschlagen", err), 0));
  if (resumed) console.info(`[video] ${resumed} unterbrochene(r) Auftrag/Aufträge fortgesetzt`);
}
