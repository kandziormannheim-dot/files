import { rateLimit } from "@/server/rate-limit";
import { meetingIcsForResponseToken } from "@/server/services/calendar";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "x";
  if (!rateLimit(`rsvp-ics:${ip}`, 60, 60 * 60_000)) return new Response("Zu viele Anfragen", { status: 429 });
  const ics = await meetingIcsForResponseToken(token);
  if (!ics) return new Response("Nicht gefunden", { status: 404 });
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="vorstandssitzung.ics"', "Cache-Control": "private, no-store" },
  });
}
