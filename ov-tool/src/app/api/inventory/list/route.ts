import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError } from "@/server/errors";
import { inventoryListPdf, type InventoryFilter } from "@/server/services/inventory";

const STATUSES = ["all", "lager", "verliehen", "ausgemustert"] as const;

// Inventarliste als PDF mit den Filtern der Übersicht (?q, ?status, ?ort); ?inventur=1 = mit Prüfspalte.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status");
  const filter: InventoryFilter = {
    q: sp.get("q")?.slice(0, 200) || undefined,
    location: sp.get("ort")?.slice(0, 200) || undefined,
    status: STATUSES.includes(status as (typeof STATUSES)[number]) ? (status as InventoryFilter["status"]) : undefined,
  };
  try {
    const { pdf, fileName } = await inventoryListPdf(user, filter, sp.get("inventur") === "1");
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${fileName}"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return new Response("Keine Berechtigung", { status: 403 });
    throw e;
  }
}
