import type { MarketingStatus } from "@prisma/client";

export const MARKETING_STATUS: Record<MarketingStatus, { label: string; variant: "secondary" | "warning" | "success" }> = {
  ENTWURF: { label: "Entwurf", variant: "secondary" },
  FREIGEGEBEN: { label: "Freigegeben", variant: "warning" },
  VEROEFFENTLICHT: { label: "Veröffentlicht", variant: "success" },
};
