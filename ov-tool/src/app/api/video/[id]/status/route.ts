import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

// Fortschritt für die Projektseite (wird alle paar Sekunden abgefragt).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "marketing.create")) return Response.json({}, { status: 401 });
  const { id } = await params;
  const p = await db.videoProject.findUnique({ where: { id }, select: { status: true, progress: true, error: true, updatedAt: true } });
  if (!p) return Response.json({}, { status: 404 });
  return Response.json(p, { headers: { "Cache-Control": "no-store" } });
}
