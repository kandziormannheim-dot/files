// Text aus Transkript-Dateien (Teams/Zoom-VTT, TXT). DOCX liest der Server mit mammoth.

/** WebVTT → „Sprecher: Text“-Zeilen; aufeinanderfolgende Beiträge derselben Person werden zusammengefasst. */
export function parseVtt(vtt: string): string {
  const lines = vtt.replace(/\r\n/g, "\n").split("\n");
  const out: { speaker: string; text: string }[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === "WEBVTT" || /^NOTE\b/.test(line) || /-->/.test(line) || /^\d+$/.test(line)) continue;
    if (/^[0-9a-f-]{20,}(\/\d+-\d+)?$/i.test(line)) continue; // Teams-Cue-IDs
    let speaker = "";
    let text = line;
    const v = /^<v\s+([^>]+)>(.*?)(<\/v>)?$/.exec(line);
    if (v) {
      speaker = v[1]!.trim();
      text = v[2]!.trim();
    } else {
      const colon = /^([^:]{2,60}):\s+(.+)$/.exec(line);
      if (colon && !/\d{2}:\d{2}/.test(colon[1]!)) {
        speaker = colon[1]!.trim();
        text = colon[2]!.trim();
      }
    }
    text = text.replace(/<[^>]+>/g, "").trim();
    if (!text) continue;
    const last = out.at(-1);
    if (last && last.speaker === speaker) last.text += ` ${text}`;
    else out.push({ speaker, text });
  }
  return out.map((o) => (o.speaker ? `${o.speaker}: ${o.text}` : o.text)).join("\n");
}

export function normalizeTranscript(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export const AUDIO_EXTENSIONS = [".m4a", ".mp3", ".wav", ".ogg", ".webm", ".mp4", ".aac", ".flac"];
export const TEXT_EXTENSIONS = [".vtt", ".txt", ".docx"];
