import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { BEZIRKE } from "@/lib/bbr-card";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requirePageCapability } from "@/server/auth/session";
import { aiConfigured } from "@/server/services/ai-draft";
import { GEN_STATUS, listConcerns, parseLastSync } from "@/server/services/bbr-social";
import { deckConfigured } from "@/server/services/deck";
import { getSettings } from "@/server/services/settings";
import { MARKETING_STATUS } from "../labels";
import {
  createTestAction,
  deleteTestAction,
  ignoreAction,
  generateAction,
  resetLogoAction,
  syncNowAction,
  uploadLogoAction,
} from "./actions";

export const metadata: Metadata = { title: "BBR-Anliegen → Social Media & Blog" };

const STATUS_VARIANT: Record<string, "secondary" | "warning" | "success" | "destructive"> = {
  NEU: "secondary",
  LAEUFT: "secondary",
  FERTIG: "success",
  GEAENDERT: "warning",
  FEHLER: "destructive",
};

export default async function BbrSocialPage() {
  const user = await requirePageCapability("read");
  const publisher = can(user.role, "marketing.publish");
  const [concerns, settings] = await Promise.all([listConcerns(user), getSettings()]);
  const lastSync = parseLastSync(settings.social.lastSync);
  const deck = deckConfigured();

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/marketing" className="underline">
          ← Marketing
        </Link>
      </div>
      <PageHeader
        title="BBR-Anliegen → Social Media & Blog"
        description="Aus der Kurzfassung eines BBR-Anliegens per Knopfdruck Entwürfe erstellen: BBR-Kanal (sachlich) und OV-Kanal (politisch) mit Texten für Facebook, Instagram, X und TikTok, Bildkachel und Kurzvideo im CDU-Design, dazu ein Blogartikel für cdu-sf.de oder bbr.cdu-sf.de. Veröffentlicht wird erst nach Freigabe."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Verbindung</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              Nextcloud Deck:{" "}
              {deck ? (
                <Badge variant="success">eingerichtet</Badge>
              ) : (
                <Badge variant="warning">noch nicht eingerichtet</Badge>
              )}{" "}
              · Board: <strong>{settings.social.deckBoards.split("\n").filter(Boolean).join(", ") || "alle sichtbaren"}</strong> · Abruf nur per Knopfdruck
            </p>
            <p>
              Texte:{" "}
              {aiConfigured() ? (
                <Badge variant="success">KI-Entwürfe (Claude)</Badge>
              ) : (
                <Badge variant="warning">ohne KI – Kurzfassung wird übernommen (ANTHROPIC_API_KEY fehlt)</Badge>
              )}
            </p>
            {lastSync ? (
              <p className={lastSync.ok ? "text-neutral-600" : "text-red-700"}>
                Letzter Abruf {formatDateTime(new Date(lastSync.at))} Uhr: {lastSync.message}
              </p>
            ) : (
              <p className="text-neutral-600">Noch kein Abruf.</p>
            )}
            <p className="text-xs text-neutral-600">
              Übernommen werden nur Überschrift, Bezirk und Kurzfassung – nie Hinweisgeber oder Erläuterung.
              „Beiträge erstellen“ ersetzt vorhandene Entwürfe; freigegebene oder veröffentlichte Beiträge bleiben erhalten.
            </p>
            {publisher && deck ? (
              <ActionForm action={syncNowAction}>
                <SubmitButton size="sm" pendingText="Wird abgerufen …">
                  Anliegen abrufen
                </SubmitButton>
              </ActionForm>
            ) : null}
          </CardContent>
        </Card>

        {publisher ? (
          <Card>
            <CardHeader>
              <CardTitle>Logos</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              {(["BBR", "OV"] as const).map((acc) => {
                const current = acc === "BBR" ? settings.social.logoBbr : settings.social.logoOv;
                return (
                  <div key={acc} className="flex flex-col gap-2">
                    <p className="font-medium">
                      {acc === "BBR" ? "BBR-Kanal" : "OV-Kanal"}: {current ? "hochgeladenes Logo" : "Standardlogo"}
                    </p>
                    {current ? null : (
                      // eslint-disable-next-line @next/next/no-img-element -- statische Datei
                      <img src={acc === "BBR" ? "/brand/logo-bbr.png" : "/brand/logo-ov.png"} alt="" className="h-12 w-auto self-start rounded border" />
                    )}
                    <ActionForm action={uploadLogoAction.bind(null, acc)} className="flex flex-wrap items-center gap-2" resetOnSuccess>
                      <Input type="file" name="logo" accept=".svg,.png,image/svg+xml,image/png" className="max-w-56" aria-label={`Logo ${acc}`} />
                      <SubmitButton size="sm" variant="outline" pendingText="…">
                        Hochladen
                      </SubmitButton>
                    </ActionForm>
                    {current ? (
                      <ActionForm action={resetLogoAction.bind(null, acc)}>
                        <SubmitButton size="sm" variant="ghost" pendingText="…">
                          Zurück zum Standardlogo
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                );
              })}
              <p className="text-xs text-neutral-600">Nur zum Ersetzen nötig: SVG oder PNG auf weißem Grund. Gilt für neu erzeugte Kacheln und Videos.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <h2 className="mt-8 mb-3 text-lg font-bold">Anliegen</h2>
      {concerns.length === 0 ? (
        <p className="text-sm text-neutral-600">Noch keine Anliegen mit Kurzfassung übernommen.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {concerns.map((c) => (
            <Card key={c.id} className={c.ignored ? "opacity-60" : undefined}>
              <CardContent className="flex flex-col gap-3 pt-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-neutral-600">
                      {c.bezirk ?? "Bezirk unbekannt"} · {c.test ? "Test-Anliegen" : `Karte #${c.deckCardId}, Stapel „${c.stack}“`}
                      {c.generatedAt ? ` · erstellt ${formatDateTime(c.generatedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {c.ignored ? <Badge variant="secondary">ignoriert</Badge> : null}
                    <Badge variant={STATUS_VARIANT[c.genStatus] ?? "secondary"}>{GEN_STATUS[c.genStatus] ?? c.genStatus}</Badge>
                  </div>
                </div>
                <p className="whitespace-pre-wrap rounded-md bg-neutral-50 p-3">{c.kurzfassung}</p>
                {c.genError ? <p className="text-red-700">Fehler: {c.genError}</p> : null}
                {c.genStatus === "GEAENDERT" ? (
                  <p className="text-amber-800">Die Kurzfassung wurde nach dem Erstellen der Beiträge geändert. Bei Bedarf neu erstellen.</p>
                ) : null}
                {c.posts.length ? (
                  <div className="flex flex-wrap gap-2">
                    {c.posts.map((p) => (
                      <Link key={p.id} href={`/marketing/${p.id}`} className="flex items-center gap-2 rounded-md border px-3 py-1.5 hover:border-akzent">
                        <span className="font-medium">
                          {p.kind === "BLOG" ? `Blog ${p.site === "SF" ? "cdu-sf.de" : "bbr.cdu-sf.de"}` : p.account === "OV" ? "OV-Kanal" : "BBR-Kanal"}
                        </span>
                        <Badge variant={MARKETING_STATUS[p.status].variant}>{MARKETING_STATUS[p.status].label}</Badge>
                        {p.mediaError ? <span className="text-xs text-red-700">Medien unvollständig</span> : null}
                      </Link>
                    ))}
                  </div>
                ) : null}
                {publisher ? (
                  <details open={c.posts.length === 0 && c.genStatus !== "LAEUFT"} className="rounded-md border p-3">
                    <summary className="cursor-pointer font-medium">{c.posts.length ? "Beiträge neu erstellen" : "Beiträge erstellen"}</summary>
                    <ActionForm action={generateAction.bind(null, c.id)} className="mt-3 flex flex-col gap-3">
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="bbr" defaultChecked /> BBR-Kanal (sachlich)
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="ov" defaultChecked /> OV-Kanal (politisch)
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="blog" defaultChecked /> Blogartikel für
                        </label>
                        <NativeSelect name="blogSite" defaultValue="BBR" aria-label="Webseite für den Blogartikel" className="w-auto">
                          <option value="BBR">bbr.cdu-sf.de</option>
                          <option value="SF">cdu-sf.de</option>
                        </NativeSelect>
                      </div>
                      {c.posts.some((p) => p.status === "ENTWURF") ? (
                        <p className="text-xs text-amber-800">Vorhandene Entwürfe der gewählten Beiträge werden ersetzt.</p>
                      ) : null}
                      <SubmitButton size="sm" className="self-start" pendingText="…" disabled={c.genStatus === "LAEUFT"}>
                        {c.genStatus === "LAEUFT" ? "Wird erstellt …" : "Erstellen"}
                      </SubmitButton>
                    </ActionForm>
                  </details>
                ) : null}
                {publisher ? (
                  <div className="flex flex-wrap gap-2">
                    <ActionForm action={ignoreAction.bind(null, c.id, !c.ignored)}>
                      <SubmitButton size="sm" variant="ghost" pendingText="…">
                        {c.ignored ? "Wieder berücksichtigen" : "Ignorieren"}
                      </SubmitButton>
                    </ActionForm>
                    {c.cardUrl ? (
                      <a href={c.cardUrl} target="_blank" rel="noopener noreferrer" className="self-center text-sm underline">
                        Karte in Nextcloud
                      </a>
                    ) : null}
                    {c.test ? (
                      <ActionForm action={deleteTestAction.bind(null, c.id)}>
                        <ConfirmSubmit size="sm" variant="ghost" className="text-red-700" confirm="Test-Anliegen und seine Entwürfe löschen?" pendingText="…">
                          Löschen
                        </ConfirmSubmit>
                      </ActionForm>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {publisher ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Test-Anliegen anlegen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-neutral-600">
              Zum Ausprobieren ohne Nextcloud: Überschrift und Kurzfassung eingeben – es entstehen dieselben Entwürfe wie bei einer echten Karte.
            </p>
            <ActionForm action={createTestAction} className="flex flex-col gap-3" resetOnSuccess>
              <Field label="Überschrift" name="title">
                <Input id="title" name="title" maxLength={300} />
              </Field>
              <Field label="Bezirk" name="bezirk">
                <NativeSelect id="bezirk" name="bezirk" defaultValue="Seckenheim">
                  {BEZIRKE.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Kurzfassung (drei Zeilen)" name="kurzfassung">
                <Textarea id="kurzfassung" name="kurzfassung" rows={4} />
              </Field>
              <SubmitButton className="self-start" pendingText="…">
                Test-Anliegen anlegen
              </SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
