import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { readStoredFile, storedFileExists } from "@/server/files";

export const dynamic = "force-dynamic";

// Unterschriftsbild nur für die Person selbst und Admins (Vorschau im Profil).
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getCurrentUser();
  const { userId } = await params;
  if (!user || (user.id !== userId && user.role !== "ADMIN")) return new Response("Kein Zugriff", { status: 403 });
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target?.signatureImagePath || !(await storedFileExists(target.signatureImagePath))) return new Response("", { status: 404 });
  const ext = target.signatureImagePath.split(".").pop();
  const type = ext === "jpg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
  return new Response(new Uint8Array(await readStoredFile(target.signatureImagePath)), {
    headers: { "Content-Type": type, "Cache-Control": "private, no-store" },
  });
}
