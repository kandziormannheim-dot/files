// Für Docker-Healthcheck und Caddy; prüft nur, ob der Server antwortet.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
