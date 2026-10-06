import { getCurrentUser } from "@/server/auth/session";
import { readPostMedia } from "@/server/services/bbr-social";

// Kachel bzw. Video eines Beitrags; ?download=1 erzwingt den Download. Range-Anfragen für die Videowiedergabe (iOS).
export async function GET(req: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const { id, kind } = await params;
  if (kind !== "image" && kind !== "video") return new Response("Nicht gefunden", { status: 404 });
  let file: Awaited<ReturnType<typeof readPostMedia>>;
  try {
    file = await readPostMedia(user, id, kind);
  } catch {
    return new Response("Nicht gefunden", { status: 404 });
  }
  const download = new URL(req.url).searchParams.has("download");
  const headers: Record<string, string> = {
    "Content-Type": file.mime,
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };
  const size = file.data.length;
  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new Response(new Uint8Array(file.data.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(file.data), { headers: { ...headers, "Content-Length": String(size) } });
}
