import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { requirePageCapability } from "@/server/auth/session";
import { aiConfigured } from "@/server/services/ai-draft";
import { prefillChoice, prefillList, prefillText, type SearchValue } from "@/lib/prefill";
import { CHANNELS, type Channel } from "@/server/services/marketing";
import { createPostAction } from "../actions";

export const metadata: Metadata = { title: "Neuer Beitrag" };

type Search = Record<"kind" | "brief" | "tone" | "channels" | "title" | "body", SearchValue>;

export default async function NewPostPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePageCapability("marketing.create");
  const ai = aiConfigured();
  const sp = await searchParams;
  const kind = prefillChoice(sp.kind, ["SOCIAL", "BLOG"] as const, "SOCIAL");
  const channels = prefillList(sp.channels, Object.keys(CHANNELS) as Channel[], ["facebook", "instagram"]);
  const title = prefillText(sp.title, 200);
  const body = prefillText(sp.body, 40000);
  const brief = prefillText(sp.brief, 8000);
  const tone = prefillText(sp.tone, 200);
  const prefilled = !!(brief || body || title);
  return (
    <>
      <PageHeader title="Neuer Beitrag" description="Stichpunkte reichen – die KI schreibt einen Entwurf, den Sie danach überarbeiten." />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <ActionForm action={createPostAction} className="flex flex-col gap-4">
            {prefilled ? (
              <p className="rounded-md border border-sky-300 bg-sky-50 p-3 text-sm">
                Vorbelegt über einen Link. Bitte prüfen; ein fertiger Text wird ohne KI-Entwurf angelegt. Freigabe und Veröffentlichung laufen wie gewohnt hier.
              </p>
            ) : null}
            <Field label="Art" name="kind">
              <NativeSelect id="kind" name="kind" defaultValue={kind}>
                <option value="SOCIAL">Social-Media-Beitrag</option>
                <option value="BLOG">Blogartikel (Webseite)</option>
              </NativeSelect>
            </Field>
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1 font-medium">Kanäle (bei Social Media)</legend>
              <div className="flex flex-wrap gap-4">
                {Object.entries(CHANNELS).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-2">
                    <input type="checkbox" name="channels[]" value={k} defaultChecked={channels.includes(k as Channel)} /> {v}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Webseite (bei Blogartikel)" name="site">
              <NativeSelect id="site" name="site" defaultValue="SF">
                <option value="SF">cdu-sf.de</option>
                <option value="BBR">bbr.cdu-sf.de (Bezirksbeirat)</option>
              </NativeSelect>
            </Field>
            <Field label="Stichpunkte / Anlass" name="brief">
              <Textarea
                id="brief"
                name="brief"
                rows={8}
                required
                defaultValue={brief}
                placeholder={"z. B.\n– Infostand am Samstag, 14.11., 10–12 Uhr, Rathausplatz Seckenheim\n– Thema: Verkehrsführung Hauptstraße\n– Ansprechpartner: Martin Kandzior, Christian Rasmus"}
              />
            </Field>
            <Field label="Tonalität (optional)" name="tone">
              <Input id="tone" name="tone" defaultValue={tone} placeholder="z. B. einladend, sachlich, feierlich" />
            </Field>
            {body ? (
              <>
                <Field label="Titel (intern)" name="title">
                  <Input id="title" name="title" defaultValue={title} maxLength={200} />
                </Field>
                <Field label="Fertiger Beitragstext" name="body" hint="Wird so als Entwurf übernommen und kann danach noch bearbeitet werden.">
                  <Textarea id="body" name="body" rows={10} defaultValue={body} />
                </Field>
              </>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="useAi" defaultChecked={ai && !body} disabled={!ai} /> Entwurf mit KI erstellen
              {!ai ? <span className="text-neutral-600">(kein API-Schlüssel hinterlegt)</span> : null}
            </label>
            <p className="text-xs text-neutral-600">
              An die KI gehen nur die Stichpunkte – keine personenbezogenen Daten von Bürgerinnen und Bürgern eintragen.
            </p>
            <SubmitButton className="self-start" pendingText="Entwurf wird erstellt …">
              Anlegen
            </SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
    </>
  );
}
