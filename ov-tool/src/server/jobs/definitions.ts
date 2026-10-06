import "server-only";
import { createDraft, transcribe } from "@/server/services/transcripts";
import { defineJob } from "./queue";

// Hintergrund-Jobs mit eigener Queue (Paket 2.2)
defineJob("transcribe", (d) => transcribe(String(d.transcriptId)));
defineJob("ai-draft", (d) => createDraft(String(d.transcriptId)));

// BBR-Anliegen → Social Media (Erzeugung dauert durch KI, Kachel und Video bis zu einigen Minuten)
defineJob("bbr-generate", async (d) => {
  const { generateForConcern } = await import("@/server/services/bbr-social");
  const { db } = await import("@/server/db");
  const actor = d.actorId ? await db.user.findUnique({ where: { id: String(d.actorId) }, select: { id: true, role: true } }) : null;
  return generateForConcern(String(d.concernId), { force: d.force === true, actor });
});
defineJob("bbr-generate-pending", async () => {
  const { runBbrSync } = await import("@/server/services/bbr-social");
  return runBbrSync(fetch, 10);
});
