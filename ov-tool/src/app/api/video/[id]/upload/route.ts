import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError, NotFoundError, UserError } from "@/server/errors";
import { uploadChunk } from "@/server/services/video";

export const dynamic = "force-dynamic";

// Upload eines Videoclips in Abschnitten (je ≤ 32 MB); Metadaten in Kopfzeilen, Inhalt als Rohdaten.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { id } = await params;
  const h = req.headers;
  try {
    const result = await uploadChunk(
      user,
      id,
      {
        uploadId: h.get("x-upload-id") ?? "",
        index: Number(h.get("x-chunk-index")),
        total: Number(h.get("x-chunk-total")),
        offset: Number(h.get("x-chunk-offset")),
        fileName: decodeURIComponent(h.get("x-file-name") ?? ""),
        fileSize: Number(h.get("x-file-size")),
      },
      Buffer.from(await req.arrayBuffer()),
    );
    return Response.json(result);
  } catch (e) {
    if (e instanceof ForbiddenError) return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
    if (e instanceof NotFoundError) return Response.json({ error: e.message }, { status: 404 });
    if (e instanceof UserError) return Response.json({ error: e.message }, { status: 400 });
    console.error("[video] Upload", e);
    return Response.json({ error: "Upload fehlgeschlagen." }, { status: 500 });
  }
}
