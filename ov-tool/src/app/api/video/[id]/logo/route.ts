import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { readStoredFile, storedFileExists } from "@/server/files";
import { branding, type SocialAccount } from "@/server/services/bbr-social";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

// Logo für die Vorschau im Editor: eigenes Logo des Videos, sonst das Kanal-Logo (wie beim Rendern).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "marketing.create")) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await params;
  const p = await db.videoProject.findUnique({ where: { id }, select: { logoPath: true, account: true } });
  if (!p) return new Response("", { status: 404 });
  const brand = await branding(p.account as SocialAccount, null);
  const rel = p.logoPath ?? brand.logoPath;
  let data: Buffer | null = null;
  let ext = "";
  if (rel && (await storedFileExists(rel))) {
    data = await readStoredFile(rel);
    ext = path.extname(rel).toLowerCase();
  } else if (brand.defaultLogo && /^[\w-]+\.(png|svg)$/.test(brand.defaultLogo)) {
    data = await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "brand", brand.defaultLogo)).catch(() => null);
    ext = path.extname(brand.defaultLogo);
  }
  if (!data) return new Response("", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": MIME[ext] ?? "image/png", "Cache-Control": "private, no-cache", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" },
  });
}
