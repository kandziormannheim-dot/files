import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError } from "@/server/errors";
import { submissionsCsv } from "@/server/services/landing";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  try {
    const csv = await submissionsCsv(user, (await params).id);
    return new Response(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="eintraege.csv"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return new Response("Keine Berechtigung", { status: 403 });
    throw e;
  }
}
