import { isVideoFormat } from "@/lib/video-plan";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { absoluteStoredPath } from "@/server/files";
import { serveFile } from "@/server/http-file";
import { outputsOf } from "@/server/services/video";

export const dynamic = "force-dynamic";

// Fertiges Video je Format (9x16, 1x1, 16x9); ?download=1 als Datei speichern.
export async function GET(req: Request, { params }: { params: Promise<{ id: string; format: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  if (!can(user.role, "marketing.create")) return new Response("Keine Berechtigung", { status: 403 });
  const { id, format: raw } = await params;
  const format = raw.replace("x", ":");
  if (!isVideoFormat(format)) return new Response("", { status: 404 });
  const p = await db.videoProject.findUnique({ where: { id }, select: { outputs: true, title: true } });
  const rel = p ? outputsOf(p).files[format] : null;
  if (!rel) return new Response("", { status: 404 });
  const download = new URL(req.url).searchParams.get("download") === "1";
  return serveFile(req, absoluteStoredPath(rel), "video/mp4", download ? { downloadName: `${p!.title.slice(0, 60)} ${raw}.mp4` } : {});
}
