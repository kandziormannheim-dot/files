import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requirePageCapability } from "@/server/auth/session";
import { POLL_NOTICE } from "@/server/services/polls";
import { createPollAction } from "../../actions";

export const metadata: Metadata = { title: "Neues Meinungsbild" };

export default async function NewPollPage() {
  await requirePageCapability("poll.create");
  return (
    <>
      <PageHeader title="Neues Meinungsbild" description={POLL_NOTICE} />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <ActionForm action={createPollAction} className="flex flex-col gap-4">
            <Field label="Frage" name="question">
              <Input id="question" name="question" required placeholder="z. B. Welcher Termin passt für das Sommerfest?" />
            </Field>
            <Field label="Erläuterung (optional)" name="description">
              <Textarea id="description" name="description" rows={2} />
            </Field>
            <Field label="Antwortmöglichkeiten" name="options" hint="eine je Zeile, mindestens zwei">
              <Textarea id="options" name="options" rows={5} required placeholder={"Samstag, 11. Juli\nSonntag, 12. Juli\nSamstag, 18. Juli"} />
            </Field>
            <Field label="Läuft bis (optional)" name="closesAt">
              <Input id="closesAt" name="closesAt" type="datetime-local" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="multiple" /> Mehrfachauswahl erlauben (z. B. Terminfindung)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="anonymous" /> anonym (Ergebnis ohne Namen)
            </label>
            <SubmitButton className="self-start">Meinungsbild starten</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
    </>
  );
}
