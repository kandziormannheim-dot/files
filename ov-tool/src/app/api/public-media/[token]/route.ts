import { readPublicMedia, verifyMediaToken } from "@/server/services/meta";

// Öffentlicher Kurzzeit-Link (signiert, 1 Stunde gültig), über den Instagram freigegebene Kacheln/Videos abholt.
// Ohne Anmeldung, aber nur mit gültiger Signatur und nur für nicht mehr im Entwurf befindliche Beiträge.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const v = verifyMediaToken((await params).token);
  if (!v) return new Response("Nicht gefunden", { status: 404 });
  const file = await readPublicMedia(v.postId, v.kind).catch(() => null);
  if (!file) return new Response("Nicht gefunden", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.data.length),
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
