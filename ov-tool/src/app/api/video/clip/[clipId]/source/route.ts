import path from "node:path";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { absoluteStoredPath } from "@/server/files";
import { serveFile } from "@/server/http-file";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".mkv": "video/x-matroska" };

// Originalclip zum Ansehen im Schnitt-Editor.
export async function GET(req: Request, { params }: { params: Promise<{ clipId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "marketing.create")) return new Response("Nicht angemeldet", { status: 401 });
  const { clipId } = await params;
  const clip = await db.videoClip.findUnique({ where: { id: clipId }, select: { path: true } });
  if (!clip) return new Response("", { status: 404 });
  return serveFile(req, absoluteStoredPath(clip.path), TYPES[path.extname(clip.path)] ?? "application/octet-stream");
}
