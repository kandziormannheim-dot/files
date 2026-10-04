import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { requirePageCapability } from "@/server/auth/session";
import { getTemplateEditor } from "@/server/services/templates";
import { resetTemplateAction, restoreTemplateAction } from "../../actions";
import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = { title: "Vorlage bearbeiten" };

export default async function TemplatePage({ params }: { params: Promise<{ key: string }> }) {
  const user = await requirePageCapability("templates.manage");
  const { key } = await params;
  const { def, body, versions } = await getTemplateEditor(user, decodeURIComponent(key));
  return (
    <>
      <PageHeader title={def.name} description={`${def.key} · ${def.usage}`} />
      <p className="mb-4 text-sm text-neutral-600">
        Platzhalter und Helfer (z. B. <code>{"{{datum sitzung.beginn}}"}</code>) sind in <code>templates/README.md</code>{" "}
        beschrieben. Unbekannte Platzhalter werden beim Speichern abgelehnt.{" "}
        <Link href="/settings/templates" className="underline">
          Alle Vorlagen
        </Link>
      </p>
      <TemplateEditor templateKey={def.key} initialBody={body} />
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Versionen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {versions.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
              <span>
                v{v.version} · {formatDateTime(v.createdAt)}
                {v.createdBy ? ` · ${v.createdBy.name}` : " · Seed"}
              </span>
              {v.active ? (
                <Badge variant="success">aktiv</Badge>
              ) : (
                <ActionForm action={restoreTemplateAction.bind(null, def.key, v.version)} showErrorInline={false}>
                  <SubmitButton size="sm" variant="outline">
                    Wiederherstellen
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
          ))}
          <ActionForm action={resetTemplateAction.bind(null, def.key)} showErrorInline={false}>
            <SubmitButton size="sm" variant="ghost">
              Ausgangsfassung aus templates/ wiederherstellen
            </SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
    </>
  );
}
