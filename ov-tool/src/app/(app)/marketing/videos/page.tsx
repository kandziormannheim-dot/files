import type { Metadata } from "next";
import Link from "next/link";
import { Film } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { requirePageCapability } from "@/server/auth/session";
import { listProjects } from "@/server/services/video";
import { VIDEO_STATUS } from "./labels";

export const metadata: Metadata = { title: "Videos" };

export default async function VideosPage() {
  const user = await requirePageCapability("marketing.create");
  const projects = await listProjects(user);
  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/marketing" className="underline">
          ← Marketing
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Videos"
          description="Clips hochladen – daraus entsteht automatisch ein Aufklärungsvideo von höchstens 30 Sekunden mit O-Tönen, Untertiteln, Einblendungen und Logo."
        />
        <Button asChild>
          <Link href="/marketing/videos/new">Neues Video</Link>
        </Button>
      </div>
      {projects.length === 0 ? (
        <p className="text-sm text-neutral-600">Noch keine Videos.</p>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/marketing/videos/${p.id}`} className="min-w-0">
              <Card className="transition hover:border-akzent">
                <CardContent className="flex items-center gap-3 pt-4 text-sm">
                  <Film className="size-5 shrink-0 text-neutral-500" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="text-neutral-600">
                      {p._count.clips} Clip{p._count.clips === 1 ? "" : "s"} · {p.formats.join(", ")} · {p.createdBy?.name ?? "–"}, {formatDate(p.createdAt)}
                    </p>
                  </div>
                  <Badge variant={VIDEO_STATUS[p.status].variant}>{VIDEO_STATUS[p.status].label}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
