import "server-only";
import { createDraft, transcribe } from "@/server/services/transcripts";
import { defineJob } from "./queue";

// Hintergrund-Jobs mit eigener Queue (Paket 2.2)
defineJob("transcribe", (d) => transcribe(String(d.transcriptId)));
defineJob("ai-draft", (d) => createDraft(String(d.transcriptId)));

// BBR-Anliegen → Social Media/Blog auf Knopfdruck (KI, Kachel und Video dauern etwa eine Minute)
defineJob("bbr-generate", async (d) => {
  const { generateForConcern } = await import("@/server/services/bbr-social");
  const { db } = await import("@/server/db");
  const actor = d.actorId ? await db.user.findUnique({ where: { id: String(d.actorId) }, select: { id: true, role: true } }) : null;
  return generateForConcern(String(d.concernId), { targets: d.targets as never, actor });
});

// Videoschnitt: Analyse (Standbilder, Whisper), Schnittplan (Claude) und Rendern dauern je nach Länge einige Minuten
defineJob("video-process", async (d) => {
  const { processProject, toProcessMode } = await import("@/server/services/video");
  return processProject(String(d.projectId), toProcessMode(d.mode), d.actorId ? String(d.actorId) : null, undefined, d.token ? String(d.token) : undefined);
});
