import type { CirculationStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const LABEL: Record<CirculationStatus, string> = {
  LAUFEND: "läuft",
  ANGENOMMEN: "angenommen",
  ABGELEHNT: "abgelehnt",
  UNZULAESSIG: "unzulässig",
  ABGEBROCHEN: "abgebrochen",
};

export function CirculationBadge({ status }: { status: CirculationStatus }) {
  const variant = status === "LAUFEND" ? "default" : status === "ANGENOMMEN" ? "success" : status === "ABGEBROCHEN" ? "outline" : "destructive";
  return <Badge variant={variant}>{LABEL[status]}</Badge>;
}
