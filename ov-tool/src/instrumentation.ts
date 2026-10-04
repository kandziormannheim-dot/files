// Läuft einmal beim Start des Next-Servers (nicht beim Build).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrap } = await import("./server/bootstrap");
  await bootstrap();
  const { startJobs } = await import("./server/jobs/runner");
  await startJobs();
}
