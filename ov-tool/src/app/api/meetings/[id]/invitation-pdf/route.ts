import { getCurrentUser } from "@/server/auth/session";
import { invitationPdf } from "@/server/services/invitations";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await params;
  try {
    const { pdf, filename } = await invitationPdf(user, id);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response("PDF konnte nicht erzeugt werden", { status: 500 });
  }
}
