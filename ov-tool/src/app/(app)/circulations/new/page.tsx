import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addBerlinDays, toDateInput } from "@/lib/dates";
import { requirePageCapability } from "@/server/auth/session";
import { getSettings } from "@/server/services/settings";
import { startCirculationAction } from "../actions";

export const metadata: Metadata = { title: "Umlaufverfahren einleiten" };

export default async function NewCirculationPage() {
  await requirePageCapability("circulation.manage");
  const s = await getSettings();
  const defaultDeadline = toDateInput(addBerlinDays(new Date(), s.circulation.defaultDays));
  return (
    <>
      <PageHeader
        title="Umlaufverfahren einleiten"
        description="Alle stimmberechtigten Vorstandsmitglieder erhalten eine E-Mail mit persönlichem Link (Vorlage umlauf.einleitung)."
      />
      <ActionForm action={startCirculationAction} className="flex max-w-2xl flex-col gap-4">
        <Field label="Betreff" name="subject">
          <Input id="subject" name="subject" required />
        </Field>
        <Field label="Beschlusstext" name="text" hint="So wie er beschlossen werden soll.">
          <Textarea id="text" name="text" rows={4} required />
        </Field>
        <Field label="Begründung (optional)" name="reason">
          <Textarea id="reason" name="reason" rows={3} />
        </Field>
        <Field label="Frist (bis einschließlich)" name="deadline">
          <Input id="deadline" name="deadline" type="date" defaultValue={defaultDeadline} required />
        </Field>
        <SubmitButton className="self-start" pendingText="Wird versendet …">
          Einleiten und versenden
        </SubmitButton>
      </ActionForm>
    </>
  );
}
