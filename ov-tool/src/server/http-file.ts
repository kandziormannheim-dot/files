import "server-only";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

/** Datei mit HTTP-Range ausliefern (Video-Spulen in Safari/iOS braucht 206-Antworten). */
export async function serveFile(req: Request, absPath: string, type: string, opts: { downloadName?: string } = {}) {
  const info = await stat(absPath).catch(() => null);
  if (!info?.isFile()) return new Response("", { status: 404 });
  const size = info.size;
  const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=600" };
  if (opts.downloadName) headers["Content-Disposition"] = `attachment; filename="${opts.downloadName.replace(/[^\w.\- ]/g, "_")}"`;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) return new Response("", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(createReadStream(absPath, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  const stream = Readable.toWeb(createReadStream(absPath)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
