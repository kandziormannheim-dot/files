import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Globe, Send, Trash2, Undo2 } from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { RichText } from "@/components/rich-text";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { getRelease, isPublic } from "@/server/services/press";
import { approveReleaseAction, deleteReleaseAction, publishReleaseAction, revokeReleaseAction, updateReleaseAction } from "../actions";
import { ReleaseForm } from "../release-form";
import { PRESS_STATUS } from "../status";

export const metadata: Metadata = { title: "Pressemitteilung" };

export default async function ReleasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let pm;
  try {
    pm = await getRelease(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const publish = can(user.role, "press.publish");
  const editable = can(user.role, "press.create") && !pm.sentAt && (pm.status !== "VEROEFFENTLICHT" || publish);
  const recipients = publish ? await db.pressContact.count({ where: { status: "AKTIV" } }) : 0;
  const st = PRESS_STATUS[pm.status];
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 self-start">
        <Link href="/press">
          <ArrowLeft className="size-4" /> Presse
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={pm.title} description={pm.subtitle || undefined} />
        <Badge variant={st.variant}>{st.label}</Badge>
      </div>
      {pm.status === "VEROEFFENTLICHT" ? (
        <Alert variant="success" className="mb-4">
          <AlertDescription>
            {isPublic(pm) ? (
              <>
                Öffentlich unter{" "}
                <a href={`/presse/${pm.slug}`} target="_blank" rel="noreferrer" className="underline">
                  /presse/{pm.slug}
                </a>
              </>
            ) : (
              `Erscheint im Portal ab ${formatDateTime(pm.embargoUntil)} (Sperrfrist).`
            )}
            {pm.sentAt ? ` · am ${formatDateTime(pm.sentAt)} an ${pm.sentCount} Empfänger versendet` : ""}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="pt-6">
            {editable ? <ReleaseForm action={updateReleaseAction.bind(null, pm.id)} pm={pm} /> : <RichText text={pm.body} />}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Freigabe & Versand</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {!publish ? <p className="text-neutral-600">Freigabe und Versand erfolgen durch den Vorsitz (Recht „Pressemitteilungen freigeben“).</p> : null}
              {publish && pm.status === "ENTWURF" ? (
                <ActionForm action={approveReleaseAction.bind(null, pm.id)} showErrorInline={false}>
                  <SubmitButton>
                    <Check className="size-4" /> Freigeben
                  </SubmitButton>
                </ActionForm>
              ) : null}
              {publish && pm.status !== "ENTWURF" && !pm.sentAt ? (
                <>
                  {pm.status !== "VEROEFFENTLICHT" ? (
                    <ActionForm action={publishReleaseAction.bind(null, pm.id, false)} showErrorInline={false}>
                      <SubmitButton variant="outline">
                        <Globe className="size-4" /> Nur im Portal veröffentlichen
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                  <ActionForm action={publishReleaseAction.bind(null, pm.id, true)} showErrorInline={false}>
                    <ConfirmSubmit confirm={`Pressemitteilung jetzt veröffentlichen und an ${recipients} Empfänger einzeln senden?`} disabled={recipients === 0} pendingText="Wird versendet …">
                      <Send className="size-4" /> Veröffentlichen & an Verteiler ({recipients})
                    </ConfirmSubmit>
                  </ActionForm>
                  {recipients === 0 ? <p className="text-xs text-neutral-600">Noch niemand im Verteiler aktiv.</p> : null}
                </>
              ) : null}
              {publish && pm.status !== "ENTWURF" && !pm.sentAt ? (
                <ActionForm action={revokeReleaseAction.bind(null, pm.id)} showErrorInline={false}>
                  <SubmitButton variant="ghost" size="sm">
                    <Undo2 className="size-4" /> Zurück in den Entwurf
                  </SubmitButton>
                </ActionForm>
              ) : null}
              {publish && !pm.sentAt ? (
                <ActionForm action={deleteReleaseAction.bind(null, pm.id)} showErrorInline={false}>
                  <ConfirmSubmit variant="ghost" size="sm" confirm="Pressemitteilung löschen?" pendingText="…">
                    <Trash2 className="size-4" /> Löschen
                  </ConfirmSubmit>
                </ActionForm>
              ) : null}
            </CardContent>
          </Card>
          {pm.clippings.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resonanz</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                {pm.clippings.map((c) => (
                  <div key={c.id}>
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noreferrer" className="underline">
                        {c.title}
                      </a>
                    ) : (
                      c.title
                    )}{" "}
                    <span className="text-neutral-500">– {c.medium}</span>
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
