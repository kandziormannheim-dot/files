import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { readStoredFile, storedFileExists } from "@/server/files";

export const dynamic = "force-dynamic";

// Inventarfotos nur für angemeldete Nutzer.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await params;
  const item = await db.inventoryItem.findUnique({ where: { id }, select: { photoPath: true } });
  if (!item?.photoPath || !(await storedFileExists(item.photoPath))) return new Response("", { status: 404 });
  return new Response(new Uint8Array(await readStoredFile(item.photoPath)), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600" },
  });
}
