import type { District, TopicStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDate } from "@/lib/dates";
import { DISTRICT_LABELS, TOPIC_STATUS_LABELS } from "@/lib/labels";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { getSettings } from "@/server/services/settings";
import { listTopics } from "@/server/services/topics";

export const metadata: Metadata = { title: "Themen" };

type Search = { status?: string; ortsteil?: string; kategorie?: string; q?: string; anliegen?: string };

export default async function TopicsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const status = sp.status === undefined ? "AKTIV" : sp.status === "" ? undefined : (sp.status as TopicStatus | "AKTIV");
  const [topics, settings] = await Promise.all([
    listTopics(user, {
      status,
      district: (sp.ortsteil || undefined) as District | undefined,
      category: sp.kategorie || undefined,
      q: sp.q?.trim() || undefined,
      concerns: sp.anliegen === "1",
    }),
    getSettings(),
  ]);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Stadtteil-Themen" description="Themen und Bürgeranliegen mit Verlauf." />
        {can(user.role, "topic.create") ? (
          <Button asChild>
            <Link href="/topics/new">Thema anlegen</Link>
          </Button>
        ) : null}
      </div>
      <form className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6" action="/topics">
        <Input name="q" defaultValue={sp.q} placeholder="Suchen …" aria-label="Suche" className="lg:col-span-2" />
        <NativeSelect name="status" defaultValue={status ?? ""} aria-label="Status">
          <option value="AKTIV">aktive</option>
          <option value="">alle Status</option>
          {Object.entries(TOPIC_STATUS_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="ortsteil" defaultValue={sp.ortsteil ?? ""} aria-label="Ortsteil">
          <option value="">beide Ortsteile</option>
          <option value="SECKENHEIM">Seckenheim</option>
          <option value="FRIEDRICHSFELD">Friedrichsfeld</option>
        </NativeSelect>
        <NativeSelect name="kategorie" defaultValue={sp.kategorie ?? ""} aria-label="Kategorie">
          <option value="">alle Kategorien</option>
          {settings.topicCategories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </NativeSelect>
        <div className="flex gap-2">
          <NativeSelect name="anliegen" defaultValue={sp.anliegen ?? ""} aria-label="Art">
            <option value="">alle</option>
            <option value="1">nur Bürgeranliegen</option>
          </NativeSelect>
          <Button type="submit" variant="outline">
            Filtern
          </Button>
        </div>
      </form>
      <ul className="flex flex-col gap-2">
        {topics.map((t) => (
          <li key={t.id}>
            <Link href={`/topics/${t.id}`} className="block rounded-lg border bg-white p-3 hover:border-akzent">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{t.title}</span>
                <span className="flex gap-1">
                  {t.forNextMeeting ? <Badge variant="warning">nächste Sitzung</Badge> : null}
                  {t.isCitizenConcern ? <Badge variant="outline">Bürgeranliegen</Badge> : null}
                  <Badge variant={t.status === "ERLEDIGT" ? "success" : "secondary"}>{TOPIC_STATUS_LABELS[t.status]}</Badge>
                </span>
              </div>
              <div className="mt-1 text-xs text-neutral-600">
                {t.category} · {DISTRICT_LABELS[t.district]}
                {t.responsible ? ` · ${t.responsible.name}` : ""} · geändert {formatDate(t.updatedAt)}
              </div>
            </Link>
          </li>
        ))}
        {topics.length === 0 ? <li className="text-sm text-neutral-600">Keine Themen gefunden.</li> : null}
      </ul>
    </>
  );
}
