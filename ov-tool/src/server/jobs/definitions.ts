import "server-only";
import { createDraft, transcribe } from "@/server/services/transcripts";
import { defineJob } from "./queue";

// Hintergrund-Jobs mit eigener Queue (Paket 2.2)
defineJob("transcribe", (d) => transcribe(String(d.transcriptId)));
defineJob("ai-draft", (d) => createDraft(String(d.transcriptId)));
