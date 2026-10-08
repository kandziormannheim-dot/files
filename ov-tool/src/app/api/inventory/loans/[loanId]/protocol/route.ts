import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError, NotFoundError, UserError } from "@/server/errors";
import { loanProtocolPdf } from "@/server/services/inventory-loans";

// Leihprotokoll als PDF: ?phase=ausgabe (Standard) oder ?phase=rueckgabe
export async function GET(req: Request, { params }: { params: Promise<{ loanId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const { loanId } = await params;
  const phase = new URL(req.url).searchParams.get("phase") === "rueckgabe" ? "RUECKGABE" : "AUSGABE";
  try {
    const { pdf, fileName } = await loanProtocolPdf(user, loanId, phase);
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${fileName}"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return new Response("Keine Berechtigung", { status: 403 });
    if (e instanceof NotFoundError) return new Response("Nicht gefunden", { status: 404 });
    if (e instanceof UserError) return new Response(e.message, { status: 400 });
    throw e;
  }
}
