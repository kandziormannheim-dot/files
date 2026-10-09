import type { VideoStatus } from "@prisma/client";

export const VIDEO_STATUS: Record<VideoStatus, { label: string; variant: "secondary" | "warning" | "success" | "destructive" }> = {
  ENTWURF: { label: "Clips hochladen", variant: "secondary" },
  ANALYSE: { label: "Clips werden analysiert", variant: "warning" },
  SCHNITT: { label: "Schnitt wird geplant", variant: "warning" },
  RENDERN: { label: "Video wird gerendert", variant: "warning" },
  FERTIG: { label: "fertig", variant: "success" },
  FEHLER: { label: "Fehler", variant: "destructive" },
};
