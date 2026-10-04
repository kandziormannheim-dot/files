import { calendarForToken } from "@/server/services/calendar";
import { rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "x";
  if (!rateLimit(`ics:${ip}`, 120, 60 * 60_000)) return new Response("Zu viele Anfragen", { status: 429 });
  const ics = await calendarForToken(token.replace(/\.ics$/, ""));
  if (!ics) return new Response("Nicht gefunden", { status: 404 });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="ov-termine.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
