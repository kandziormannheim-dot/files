import { getCurrentUser } from "@/server/auth/session";
import { downloadMinutes } from "@/server/services/minutes-export";

export const dynamic = "force-dynamic";

// PDF/DOCX-Download – nur angemeldet, wird im Audit-Log erfasst (SPEC.md 3.3 Vertraulichkeit).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") === "docx" ? "docx" : "pdf";
  try {
    const { data, filename, contentType } = await downloadMinutes(user, id, format);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${format === "pdf" ? "inline" : "attachment"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response("Dokument konnte nicht erzeugt werden", { status: 500 });
  }
}
