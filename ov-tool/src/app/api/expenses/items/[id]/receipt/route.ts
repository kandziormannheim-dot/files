import { getCurrentUser } from "@/server/auth/session";
import { readReceipt } from "@/server/services/expenses";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  try {
    const { data, name, mime } = await readReceipt(user, (await params).id);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Nicht gefunden", { status: 404 });
  }
}
