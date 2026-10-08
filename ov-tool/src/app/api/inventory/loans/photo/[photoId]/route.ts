import { getCurrentUser } from "@/server/auth/session";
import { loanPhotoFile } from "@/server/services/inventory-loans";

export const dynamic = "force-dynamic";

// Fotos aus Leihprotokollen nur für angemeldete Nutzer.
export async function GET(_req: Request, { params }: { params: Promise<{ photoId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const { photoId } = await params;
  const data = await loanPhotoFile(photoId).catch(() => null);
  if (!data) return new Response("", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600" } });
}
