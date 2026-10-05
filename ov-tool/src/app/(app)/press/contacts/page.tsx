import type { Metadata } from "next";
import { Check, Trash2, UserMinus } from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { requirePageCapability } from "@/server/auth/session";
import { listContacts } from "@/server/services/press";
import { addContactAction, deleteContactAction, setContactStatusAction } from "../actions";
import { PressTabs } from "../press-tabs";

export const metadata: Metadata = { title: "Presseverteiler" };

const STATUS = {
  UNBESTAETIGT: { label: "E-Mail unbestätigt", variant: "secondary" },
  WARTET: { label: "wartet auf Freigabe", variant: "warning" },
  AKTIV: { label: "aktiv", variant: "success" },
  ABGEMELDET: { label: "abgemeldet", variant: "outline" },
} as const;

export default async function ContactsPage() {
  const user = await requirePageCapability("press.contacts");
  const contacts = await listContacts(user);
  return (
    <>
      <PageHeader title="Presse" description="Presseverteiler: Registrierung über /presse/registrierung mit Double-Opt-in, danach Freigabe hier." />
      <PressTabs active="contacts" showContacts />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ul className="flex flex-col gap-2">
          {contacts.length === 0 ? <li className="text-sm text-neutral-600">Noch keine Kontakte.</li> : null}
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-rhoendorf">
                  {c.name} <span className="font-normal text-neutral-600">· {c.medium}{c.role ? `, ${c.role}` : ""}</span>
                </div>
                <div className="truncate text-xs text-neutral-600">
                  {c.email}
                  {c.phone ? ` · ${c.phone}` : ""}
                  {c.topics ? ` · ${c.topics}` : ""} · seit {formatDate(c.createdAt)}
                </div>
              </div>
              <Badge variant={STATUS[c.status].variant}>{STATUS[c.status].label}</Badge>
              {c.status === "WARTET" || c.status === "ABGEMELDET" ? (
                <ActionForm action={setContactStatusAction.bind(null, c.id, "AKTIV")} showErrorInline={false}>
                  <SubmitButton size="sm" pendingText="…">
                    <Check className="size-4" /> {c.status === "WARTET" ? "Freigeben" : "Reaktivieren"}
                  </SubmitButton>
                </ActionForm>
              ) : null}
              {c.status === "AKTIV" ? (
                <ActionForm action={setContactStatusAction.bind(null, c.id, "ABGEMELDET")} showErrorInline={false}>
                  <SubmitButton size="sm" variant="ghost" pendingText="…" aria-label="Deaktivieren">
                    <UserMinus className="size-4" />
                  </SubmitButton>
                </ActionForm>
              ) : null}
              <ActionForm action={deleteContactAction.bind(null, c.id)} showErrorInline={false}>
                <ConfirmSubmit size="sm" variant="ghost" confirm={`${c.name} endgültig löschen?`} pendingText="…" aria-label="Löschen">
                  <Trash2 className="size-4" />
                </ConfirmSubmit>
              </ActionForm>
            </li>
          ))}
        </ul>
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Kontakt direkt aufnehmen</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={addContactAction} resetOnSuccess className="flex flex-col gap-3">
              <Field label="Name" name="name">
                <Input id="name" name="name" required />
              </Field>
              <Field label="Medium" name="medium">
                <Input id="medium" name="medium" required />
              </Field>
              <Field label="Funktion" name="role">
                <Input id="role" name="role" />
              </Field>
              <Field label="E-Mail" name="email">
                <Input id="email" name="email" type="email" required />
              </Field>
              <Field label="Telefon" name="phone">
                <Input id="phone" name="phone" />
              </Field>
              <Field label="Themen" name="topics">
                <Input id="topics" name="topics" />
              </Field>
              <p className="text-xs text-neutral-600">Nur für Redaktionen, die dem Versand zugestimmt haben (z. B. bekannte Lokalredaktion).</p>
              <SubmitButton className="self-start">Aufnehmen</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
