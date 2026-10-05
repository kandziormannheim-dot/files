import { rateLimit } from "@/server/rate-limit";
import { readAttachmentByResponseToken } from "@/server/services/attachments";

export const dynamic = "force-dynamic";

// Sitzungsunterlagen für Eingeladene ohne Login – nur über den persönlichen Rückmelde-Link und nur freigegebene Dateien.
export async function GET(req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "x";
  if (!rateLimit(`rsvp-file:${ip}`, 120, 60 * 60_000)) return new Response("Zu viele Anfragen", { status: 429 });
  const r = await readAttachmentByResponseToken(token, id);
  if (!r) return new Response("Nicht gefunden", { status: 404 });
  const inline = r.attachment.mimeType === "application/pdf" || r.attachment.mimeType.startsWith("image/");
  return new Response(new Uint8Array(r.data), {
    headers: {
      "Content-Type": r.attachment.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(r.attachment.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
