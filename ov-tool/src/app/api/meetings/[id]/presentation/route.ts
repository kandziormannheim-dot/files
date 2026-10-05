import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError } from "@/server/errors";
import { buildMeetingPresentation } from "@/server/services/presentation";
import { audit } from "@/server/audit";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

// PowerPoint für die Sitzungsleitung – nur angemeldet und mit Sitzungsrechten.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await params;
  try {
    const { data, filename } = await buildMeetingPresentation(user, id);
    await audit(db, user, "meeting.presentation", "Meeting", id);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) return new Response("Kein Zugriff", { status: 403 });
    console.error(err);
    return new Response("Präsentation konnte nicht erzeugt werden", { status: 500 });
  }
}
