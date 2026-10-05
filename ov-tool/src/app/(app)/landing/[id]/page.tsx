import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive, Check, Download, EyeOff, Trash2 } from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { qrSvg } from "@/server/barcode";
import { NotFoundError } from "@/server/errors";
import { appUrl } from "@/server/ov";
import { getPage, isLive, landingLinks, listSubmissions } from "@/server/services/landing";
import { deletePageAction, deleteSubmissionAction, setPageStatusAction, updatePageAction } from "../actions";
import { PageForm } from "../page-form";

export const metadata: Metadata = { title: "Landing Page" };

export default async function LandingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let page;
  try {
    page = await getPage(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const publish = can(user.role, "landing.publish");
  const url = `${appUrl()}/p/${page.slug}`;
  const qr = await qrSvg(url);
  const submissions = publish ? await listSubmissions(user, page.id) : [];
  const linksText = landingLinks(page)
    .map((l) => `${l.label} | ${l.url}`)
    .join("\n");
  const live = isLive(page);
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 self-start">
        <Link href="/landing">
          <ArrowLeft className="size-4" /> Landing Pages
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={page.title} description={`/p/${page.slug} · ${page.views} Aufrufe · ${page._count.submissions} Einträge`} />
        {live ? <Badge variant="success">online</Badge> : <Badge variant="warning">{page.status === "ARCHIVIERT" ? "archiviert" : page.status === "FREIGEGEBEN" ? "abgelaufen" : "Entwurf"}</Badge>}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="pt-6">
            {can(user.role, "landing.edit") ? <PageForm action={updatePageAction.bind(null, page.id)} page={page} linksText={linksText} /> : <p>Keine Bearbeitungsrechte.</p>}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Veröffentlichung</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <a href={live ? url : `/p/${page.slug}`} target="_blank" rel="noreferrer" className="break-all underline">
                {url}
              </a>
              {!live ? <p className="text-xs text-neutral-600">Vorschau erst nach Freigabe öffentlich erreichbar.</p> : null}
              <div className="w-40 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="text-xs text-neutral-600">QR-Code für Plakate und Flyer (Rechtsklick → Bild speichern oder Seite drucken).</p>
              {publish ? (
                <div className="flex flex-wrap gap-2">
                  {page.status !== "FREIGEGEBEN" ? (
                    <ActionForm action={setPageStatusAction.bind(null, page.id, "FREIGEGEBEN")} showErrorInline={false}>
                      <SubmitButton size="sm">
                        <Check className="size-4" /> Freigeben (online)
                      </SubmitButton>
                    </ActionForm>
                  ) : (
                    <ActionForm action={setPageStatusAction.bind(null, page.id, "ENTWURF")} showErrorInline={false}>
                      <SubmitButton size="sm" variant="outline">
                        <EyeOff className="size-4" /> Offline nehmen
                      </SubmitButton>
                    </ActionForm>
                  )}
                  {page.status !== "ARCHIVIERT" ? (
                    <ActionForm action={setPageStatusAction.bind(null, page.id, "ARCHIVIERT")} showErrorInline={false}>
                      <SubmitButton size="sm" variant="ghost">
                        <Archive className="size-4" /> Archivieren
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                  <ActionForm action={deletePageAction.bind(null, page.id)} showErrorInline={false}>
                    <ConfirmSubmit size="sm" variant="ghost" confirm="Seite samt allen Einträgen löschen?" pendingText="…">
                      <Trash2 className="size-4" /> Löschen
                    </ConfirmSubmit>
                  </ActionForm>
                </div>
              ) : (
                <p className="text-xs text-neutral-600">Freigabe durch Admin bzw. Recht „Landing Pages freigeben“.</p>
              )}
            </CardContent>
          </Card>
          {publish ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">Einträge ({submissions.length})</CardTitle>
                {submissions.length ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/landing/${page.id}/csv`}>
                      <Download className="size-4" /> CSV
                    </a>
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p className="text-xs text-neutral-600">Automatische Löschung nach {page.retentionDays} Tagen.</p>
                {submissions.map((s) => (
                  <div key={s.id} className="flex items-start gap-2 border-t pt-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{s.name}</div>
                      <div className="break-all text-xs text-neutral-600">
                        {s.email}
                        {s.phone ? ` · ${s.phone}` : ""} · {formatDateTime(s.createdAt)}
                        {s.newsletter ? (s.confirmedAt ? " · Newsletter bestätigt" : " · Newsletter unbestätigt") : ""}
                      </div>
                      {s.message ? <p className="mt-1 whitespace-pre-line">{s.message}</p> : null}
                    </div>
                    <ActionForm action={deleteSubmissionAction.bind(null, page.id, s.id)} showErrorInline={false}>
                      <SubmitButton size="sm" variant="ghost" pendingText="…" aria-label="Eintrag löschen">
                        <Trash2 className="size-4" />
                      </SubmitButton>
                    </ActionForm>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
