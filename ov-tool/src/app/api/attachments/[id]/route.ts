import { getCurrentUser } from "@/server/auth/session";
import { readAttachment } from "@/server/services/attachments";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await params;
  try {
    const { attachment, data } = await readAttachment(user, id);
    const inline = attachment.mimeType.startsWith("image/") || attachment.mimeType === "application/pdf";
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Nicht gefunden", { status: 404 });
  }
}
