import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { readStoredFile } from "@/server/files";
import { stillsOf } from "@/server/services/video";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ clipId: string; n: string }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "marketing.create")) return new Response("Nicht angemeldet", { status: 401 });
  const { clipId, n } = await params;
  const clip = await db.videoClip.findUnique({ where: { id: clipId }, select: { stills: true } });
  const still = clip ? stillsOf(clip)[Number(n)] : undefined;
  if (!still) return new Response("", { status: 404 });
  const data = await readStoredFile(still.path).catch(() => null);
  if (!data) return new Response("", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" } });
}
