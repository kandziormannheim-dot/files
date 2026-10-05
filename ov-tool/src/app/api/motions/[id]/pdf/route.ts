import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { motionPdf } from "@/server/services/resolutions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  try {
    const { pdf, fileName } = await motionPdf(user, (await params).id);
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${fileName}"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return new Response("Nicht gefunden", { status: 404 });
    if (e instanceof ForbiddenError) return new Response("Keine Berechtigung", { status: 403 });
    throw e;
  }
}
