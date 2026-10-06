import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { CHANNELS, listPosts, type Channel } from "@/server/services/marketing";
import { MARKETING_STATUS } from "./labels";

export const metadata: Metadata = { title: "Marketing" };

export default async function MarketingPage() {
  const user = await requireUser();
  const posts = await listPosts(user);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Marketing"
          description="Social-Media-Beiträge und Blogartikel: KI-Entwurf aus Stichpunkten, gemeinsam überarbeiten, freigeben, veröffentlichen."
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/marketing/bbr">BBR-Anliegen → Social Media &amp; Blog</Link>
          </Button>
          {can(user.role, "marketing.create") ? (
            <Button asChild>
              <Link href="/marketing/new">Neuer Beitrag</Link>
            </Button>
          ) : null}
        </div>
      </div>
      {posts.length === 0 ? (
        <p className="text-sm text-neutral-600">Noch keine Beiträge.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {posts.map((p) => (
            <Link key={p.id} href={`/marketing/${p.id}`} className="min-w-0">
              <Card className="transition hover:border-akzent">
                <CardContent className="flex flex-col gap-1 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.title || "(ohne Titel)"}</p>
                    <p className="text-neutral-600">
                      {p.kind === "BLOG" ? `Blog · ${p.site === "BBR" ? "bbr.cdu-sf.de" : "cdu-sf.de"}` : `Social${p.account ? ` · ${p.account === "BBR" ? "BBR-Kanal" : "OV-Kanal"}` : ""} · ${p.channels.map((c) => CHANNELS[c as Channel] ?? c).join(", ") || "–"}`}
                      {" · "}
                      {p.createdBy?.name ?? "–"}, {formatDate(p.updatedAt)}
                      {p.plannedFor ? ` · geplant ${formatDate(p.plannedFor)}` : ""}
                    </p>
                  </div>
                  <Badge variant={MARKETING_STATUS[p.status].variant}>{MARKETING_STATUS[p.status].label}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
