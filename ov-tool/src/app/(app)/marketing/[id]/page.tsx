import { InlineBold } from "@/components/inline-bold";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, toDateTimeInput } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { CHANNELS, canEditPost, getPost, wordpressSites } from "@/server/services/marketing";
import { blogToHtml } from "@/server/services/wordpress";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { metaConfig, publishedBlogLink, type MetaAccount } from "@/server/services/meta";
import {
  approvePostAction,
  publishMetaAction,
  deletePostAction,
  markPublishedAction,
  revokePostAction,
  updatePostAction,
  wordpressAction,
} from "../actions";
import { bbrAccountName } from "@/lib/bbr-card";
import { getSettings } from "@/server/services/settings";
import { MARKETING_STATUS } from "../labels";
import { updateCreativeAction } from "../bbr/actions";
import { CopyText, MediaShare } from "./media-share";
import { ShareTools } from "./share-tools";

export const metadata: Metadata = { title: "Beitrag" };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const post = await getPost(user, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const editable = canEditPost(user, post);
  const publisher = can(user.role, "marketing.publish");
  const wpSites = wordpressSites();
  const site = wpSites.find((s) => s.key === (post.site ?? "SF"));
  const socialText = [post.body.trim(), post.hashtags.trim()].filter(Boolean).join("\n\n");
  const st = MARKETING_STATUS[post.status];
  const accountName = post.account === "BBR" ? bbrAccountName(post.bbrConcern?.bezirk) : `CDU ${(await getSettings()).ov.name}`;
  const variants = (post.variants ?? {}) as { instagram?: string; x?: string; tiktok?: string };
  const creative = post.creative as { headline: string; subline: string; scenes: string[]; outro: string } | null;
  const hashtags = post.hashtags.trim();
  const withTags = (t: string) => [t.trim(), hashtags].filter(Boolean).join("\n\n");
  const mediaBase = `/api/marketing/${post.id}/media`;
  const meta = post.kind === "SOCIAL" && (post.account === "OV" || post.account === "BBR") ? metaConfig(post.account as MetaAccount) : null;
  const blogLink = meta ? await publishedBlogLink(post.bbrConcernId, post.account as MetaAccount) : null;
  const published = (network: string, format: string) => post.publications.some((p) => p.network === network && p.format === format);
  const outdated = post.bbrConcern && post.sourceKey && post.bbrConcern.sourceKey !== post.sourceKey;

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/marketing" className="underline">
          ← Marketing
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={post.title || "(ohne Titel)"}
          description={`${post.kind === "BLOG" ? `Blogartikel für ${site?.label}` : `Social-Media-Beitrag${post.account ? ` · ${accountName}` : ""}`} · ${post.bbrConcern ? "automatisch aus BBR-Anliegen" : `angelegt von ${post.createdBy?.name ?? "–"}`}${post.approvedBy ? ` · freigegeben von ${post.approvedBy.name}` : ""}`}
        />
        <Badge variant={st.variant}>{st.label}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bearbeiten</CardTitle>
          </CardHeader>
          <CardContent>
            {editable ? (
              <ActionForm action={updatePostAction.bind(null, post.id)} className="flex flex-col gap-4">
                <Field label={post.kind === "BLOG" ? "Überschrift" : "Interner Titel"} name="title">
                  <Input id="title" name="title" defaultValue={post.title} maxLength={200} />
                </Field>
                <Field
                  label="Text"
                  name="body"
                  hint={post.kind === "BLOG" ? "Absätze mit Leerzeile trennen, Zwischenüberschriften mit „## “ beginnen." : `${post.body.length} Zeichen`}
                >
                  <Textarea id="body" name="body" defaultValue={post.body} rows={post.kind === "BLOG" ? 20 : 12} />
                </Field>
                {post.kind === "SOCIAL" ? (
                  <>
                    <Field label="Hashtags" name="hashtags">
                      <Input id="hashtags" name="hashtags" defaultValue={post.hashtags} />
                    </Field>
                    <fieldset className="flex flex-wrap gap-4 text-sm">
                      <legend className="mb-1 font-medium">Kanäle</legend>
                      {Object.entries(CHANNELS).map(([k, v]) => (
                        <label key={k} className="flex items-center gap-2">
                          <input type="checkbox" name="channels[]" value={k} defaultChecked={post.channels.includes(k)} /> {v}
                        </label>
                      ))}
                    </fieldset>
                  </>
                ) : (
                  <Field label="Standard-Webseite (Vorauswahl beim Senden)" name="site">
                    <NativeSelect id="site" name="site" defaultValue={post.site ?? "SF"}>
                      <option value="SF">cdu-sf.de</option>
                      <option value="BBR">bbr.cdu-sf.de</option>
                    </NativeSelect>
                  </Field>
                )}
                <Field label="Geplant für (optional)" name="plannedFor">
                  <Input id="plannedFor" name="plannedFor" type="datetime-local" defaultValue={post.plannedFor ? toDateTimeInput(post.plannedFor) : ""} />
                </Field>
                {post.status === "FREIGEGEBEN" ? (
                  <p className="text-xs text-amber-800">Änderungen an Titel oder Text heben die Freigabe auf.</p>
                ) : null}
                <SubmitButton className="self-start">Speichern</SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-sm text-neutral-600">
                {post.status === "VEROEFFENTLICHT" ? "Veröffentlichte Beiträge sind gesperrt." : "Bearbeiten können die Verfasserin bzw. der Verfasser (im Entwurf) und der Admin."}
              </p>
            )}
            {post.brief ? (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-neutral-600">Ursprüngliche Stichpunkte</summary>
                <p className="mt-2 whitespace-pre-wrap">{post.brief}</p>
              </details>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Vorschau</CardTitle>
            </CardHeader>
            <CardContent>
              {post.kind === "BLOG" ? (
                <article className="prose-sm flex flex-col gap-3 text-sm [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold">
                  <h1 className="text-lg font-bold">{post.title}</h1>
                  <div dangerouslySetInnerHTML={{ __html: blogToHtml(post.body).replace(/<!--[^>]*-->/g, "") }} className="flex flex-col gap-3" />
                </article>
              ) : (
                <div className="mx-auto max-w-sm rounded-xl border bg-white p-4 text-sm shadow-sm">
                  <p className="mb-2 font-semibold">{accountName}</p>
                  {post.imagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element -- geschützte Datei, kein Bild-Optimierer
                    <img src={`${mediaBase}/image`} alt="Bildkachel" className="mb-3 w-full rounded-md border" />
                  ) : null}
                  <p className="whitespace-pre-wrap">{post.body || "–"}</p>
                  {post.hashtags ? <p className="mt-2 text-akzent-dunkel">{post.hashtags}</p> : null}
                </div>
              )}
            </CardContent>
          </Card>

          {outdated ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Die Kurzfassung des BBR-Anliegens wurde seitdem geändert. Unter{" "}
              <Link href="/marketing/bbr" className="underline">
                BBR-Anliegen
              </Link>{" "}
              lassen sich die Entwürfe neu erstellen.
            </p>
          ) : null}

          {post.bbrConcern ? (
            <Card>
              <CardHeader>
                <CardTitle>Grundlage: Kurzfassung</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="font-medium">{post.bbrConcern.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-neutral-700"><InlineBold text={post.bbrConcern.kurzfassung} /></p>
              </CardContent>
            </Card>
          ) : null}

          {creative || post.imagePath || post.videoPath ? (
            <Card>
              <CardHeader>
                <CardTitle>{post.kind === "BLOG" ? "Beitragsbild" : "Bildkachel & Kurzvideo"}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm">
                {post.mediaError ? <p className="text-red-700">{post.mediaError}</p> : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  {post.imagePath ? (
                    <div className="flex flex-col gap-2">
                      <p className="font-medium">{post.kind === "BLOG" ? "Wird beim Senden an WordPress als Beitragsbild hochgeladen" : "Kachel 1080×1350 (Facebook, Instagram)"}</p>
                      {/* eslint-disable-next-line @next/next/no-img-element -- geschützte Datei */}
                      <img src={`${mediaBase}/image`} alt="Bildkachel" className="w-full rounded-md border" />
                      <MediaShare src={`${mediaBase}/image`} fileName="kachel.png" mime="image/png" text={withTags(post.body)} label="Kachel" />
                    </div>
                  ) : null}
                  {post.videoPath ? (
                    <div className="flex flex-col gap-2">
                      <p className="font-medium">Video 9:16 (Reels, TikTok, Shorts)</p>
                      <video src={`${mediaBase}/video`} controls playsInline preload="metadata" className="w-full max-w-64 rounded-md border bg-black" />
                      <MediaShare
                        src={`${mediaBase}/video`}
                        fileName="video.mp4"
                        mime="video/mp4"
                        text={withTags(variants.instagram || post.body)}
                        label="Video"
                      />
                    </div>
                  ) : null}
                </div>
                {creative && editable ? (
                  <details>
                    <summary className="cursor-pointer font-medium">{post.kind === "BLOG" ? "Text im Beitragsbild ändern" : "Schlagzeile und Videotafeln ändern"}</summary>
                    <ActionForm action={updateCreativeAction.bind(null, post.id)} className="mt-3 flex flex-col gap-3">
                      <Field label="Schlagzeile (max. 80 Zeichen)" name="headline">
                        <Input id="headline" name="headline" defaultValue={creative.headline} maxLength={80} />
                      </Field>
                      <Field label="Unterzeile der Kachel" name="subline">
                        <Input id="subline" name="subline" defaultValue={creative.subline} maxLength={120} />
                      </Field>
                      <Field label="Videotafeln (eine je Zeile, höchstens vier)" name="scenes">
                        <Textarea id="scenes" name="scenes" defaultValue={creative.scenes.join("\n")} rows={4} />
                      </Field>
                      <Field label="Abschlusstafel" name="outro">
                        <Input id="outro" name="outro" defaultValue={creative.outro} maxLength={70} />
                      </Field>
                      <SubmitButton className="self-start" variant="outline" pendingText="Wird erzeugt … (ca. 30 Sek.)">
                        Kachel und Video neu erzeugen
                      </SubmitButton>
                    </ActionForm>
                  </details>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {variants.instagram || variants.x || variants.tiktok ? (
            <Card>
              <CardHeader>
                <CardTitle>Texte für weitere Kanäle</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm">
                {(
                  [
                    ["Instagram", variants.instagram ? withTags(variants.instagram) : ""],
                    ["X", variants.x ?? ""],
                    ["TikTok", variants.tiktok ? withTags(variants.tiktok) : ""],
                  ] as const
                )
                  .filter(([, t]) => t)
                  .map(([name, t]) => (
                    <div key={name} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">
                          {name} <span className="font-normal text-neutral-500">· {t.length} Zeichen</span>
                        </p>
                        {post.status !== "ENTWURF" ? <CopyText text={t} /> : null}
                      </div>
                      <p className="whitespace-pre-wrap rounded-md bg-neutral-50 p-3">{t}</p>
                    </div>
                  ))}
                <p className="text-xs text-neutral-600">Kopieren ist nach der Freigabe möglich.</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Freigabe &amp; Veröffentlichung</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {post.status === "ENTWURF" ? (
                publisher ? (
                  <ActionForm action={approvePostAction.bind(null, post.id)} className="flex flex-col gap-2">
                    <SubmitButton pendingText="…" className="self-start">
                      Freigeben
                    </SubmitButton>
                    <p className="text-xs text-neutral-600">
                      {post.kind === "BLOG"
                        ? `Nach der Freigabe erscheinen hier „Als Entwurf an WordPress“ und „Direkt veröffentlichen“ (${site?.label}).`
                        : "Nach der Freigabe erscheinen hier Teilen, Herunterladen und – sobald eingerichtet – Facebook/Instagram."}
                    </p>
                  </ActionForm>
                ) : (
                  <p className="text-neutral-600">Wartet auf Freigabe durch den Admin.</p>
                )
              ) : null}

              {post.status === "FREIGEGEBEN" && post.approvedAt ? (
                <p>Freigegeben am {formatDateTime(post.approvedAt)} Uhr.</p>
              ) : null}

              {meta && post.status !== "ENTWURF" && publisher ? (
                <div className="flex flex-col gap-2 rounded-md border p-3">
                  <p className="font-medium">Direkt veröffentlichen ({post.account === "OV" ? "Seite des Ortsverbands" : "Seite der BBR-Gruppe"})</p>
                  {!meta.facebook && !meta.instagram ? (
                    <p className="text-neutral-600">Für diesen Kanal sind noch keine Facebook-/Instagram-Zugänge hinterlegt.</p>
                  ) : null}
                  {meta.facebook ? (
                    <ActionForm action={publishMetaAction.bind(null, post.id, "facebook", "image")} className="flex flex-wrap items-center gap-3">
                      {blogLink ? (
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" name="withBlogLink" defaultChecked /> Link zum Blogartikel anhängen
                        </label>
                      ) : null}
                      <ConfirmSubmit size="sm" disabled={published("facebook", "image") || !post.imagePath} confirm="Kachel mit Text jetzt auf Facebook veröffentlichen?" pendingText="Wird veröffentlicht …">
                        {published("facebook", "image") ? "Facebook: Kachel veröffentlicht" : "Facebook: Kachel posten"}
                      </ConfirmSubmit>
                    </ActionForm>
                  ) : null}
                  {meta.facebook && post.videoPath ? (
                    <ActionForm action={publishMetaAction.bind(null, post.id, "facebook", "video")}>
                      <ConfirmSubmit size="sm" variant="outline" disabled={published("facebook", "video")} confirm="Video mit Text jetzt auf Facebook veröffentlichen?" pendingText="Wird hochgeladen …">
                        {published("facebook", "video") ? "Facebook: Video veröffentlicht" : "Facebook: Video posten"}
                      </ConfirmSubmit>
                    </ActionForm>
                  ) : null}
                  {meta.instagram ? (
                    <div className="flex flex-wrap gap-2">
                      {post.imagePath ? (
                        <ActionForm action={publishMetaAction.bind(null, post.id, "instagram", "image")}>
                          <ConfirmSubmit size="sm" variant="outline" disabled={published("instagram", "image")} confirm="Kachel jetzt auf Instagram veröffentlichen?" pendingText="Wird veröffentlicht …">
                            {published("instagram", "image") ? "Instagram: Kachel veröffentlicht" : "Instagram: Kachel posten"}
                          </ConfirmSubmit>
                        </ActionForm>
                      ) : null}
                      {post.videoPath ? (
                        <ActionForm action={publishMetaAction.bind(null, post.id, "instagram", "video")}>
                          <ConfirmSubmit size="sm" variant="outline" disabled={published("instagram", "video")} confirm="Video jetzt als Reel auf Instagram veröffentlichen? Das kann bis zu drei Minuten dauern." pendingText="Instagram verarbeitet das Video …">
                            {published("instagram", "video") ? "Instagram: Reel veröffentlicht" : "Instagram: Reel posten"}
                          </ConfirmSubmit>
                        </ActionForm>
                      ) : null}
                    </div>
                  ) : null}
                  {post.publications.length ? (
                    <ul className="mt-1 flex flex-col gap-1 text-xs text-neutral-700">
                      {post.publications.map((p) => (
                        <li key={p.id}>
                          {p.network === "facebook" ? "Facebook" : "Instagram"} ({p.format === "image" ? "Kachel" : "Video"}) am {formatDateTime(p.createdAt)} Uhr
                          {p.createdBy ? ` von ${p.createdBy.name}` : ""}
                          {p.permalink ? (
                            <>
                              {" · "}
                              <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="underline">
                                ansehen
                              </a>
                            </>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {post.kind === "SOCIAL" && post.status !== "ENTWURF" ? (
                <>
                  <ShareTools text={socialText} />
                  <p className="text-xs text-neutral-600">
                    Alternativ: Text kopieren bzw. teilen oder in der Meta Business Suite einplanen (TikTok, X und andere Kanäle über
                    „Teilen …“ auf dem Handy).
                  </p>
                </>
              ) : null}

              {post.kind === "BLOG" && post.status !== "ENTWURF" && publisher ? (
                wpSites.some((s) => s.configured) ? (
                  <ActionForm action={wordpressAction.bind(null, post.id)} className="flex flex-col gap-3 rounded-md border p-3">
                    <p className="font-medium">An WordPress senden</p>
                    <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
                      <legend className="sr-only">Webseiten</legend>
                      {wpSites.map((s) => {
                        const pub = post.wordpress.find((w) => w.site === s.key);
                        return (
                          <label key={s.key} className={`flex items-center gap-2 ${s.configured ? "" : "text-neutral-400"}`}>
                            <input type="checkbox" name="sites" value={s.key} disabled={!s.configured} defaultChecked={s.configured && (pub ? true : s.key === (post.site ?? "SF"))} />
                            {s.label}
                            {pub ? <span className="text-xs text-neutral-500">({pub.wpStatus === "publish" ? "veröffentlicht" : "Entwurf"})</span> : null}
                            {!s.configured ? <span className="text-xs">(kein Zugang)</span> : null}
                          </label>
                        );
                      })}
                    </fieldset>
                    <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
                      <legend className="sr-only">Art</legend>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="mode" value="draft" defaultChecked /> als Entwurf (in WordPress prüfen)
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="mode" value="publish" /> direkt veröffentlichen
                      </label>
                    </fieldset>
                    <SubmitButton className="self-start" pendingText="Wird übertragen …">
                      {post.wordpress.length ? "Erneut senden / aktualisieren" : "An WordPress senden"}
                    </SubmitButton>
                    <p className="text-xs text-neutral-600">
                      Ein Häkchen bei beiden Seiten veröffentlicht denselben Artikel auf cdu-sf.de und bbr.cdu-sf.de. Erneutes Senden aktualisiert
                      den bestehenden WordPress-Beitrag statt einen neuen anzulegen; das Beitragsbild wird je Seite einmal hochgeladen.
                    </p>
                  </ActionForm>
                ) : (
                  <p className="text-neutral-600">Für die Webseiten sind noch keine WordPress-Zugangsdaten hinterlegt. Bis dahin: Text kopieren und in WordPress einfügen.</p>
                )
              ) : null}

              {post.kind === "BLOG" && post.wordpress.length ? (
                <ul className="flex flex-col gap-1">
                  {post.wordpress.map((w) => (
                    <li key={w.id}>
                      {w.site === "SF" ? "cdu-sf.de" : "bbr.cdu-sf.de"} ({w.wpStatus === "publish" ? "veröffentlicht" : "Entwurf"}):{" "}
                      <a href={w.wpLink} target="_blank" rel="noopener noreferrer" className="break-all underline">
                        {w.wpLink}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}

              {post.kind === "BLOG" && post.status !== "ENTWURF" ? (
                <ShareTools text={post.title} url={post.wordpress.find((w) => w.wpStatus === "publish")?.wpLink ?? null} />
              ) : null}

              {post.status === "FREIGEGEBEN" && publisher ? (
                <div className="flex flex-wrap gap-2">
                  <ActionForm action={markPublishedAction.bind(null, post.id)}>
                    <SubmitButton variant="outline" size="sm" pendingText="…">
                      Als veröffentlicht vermerken
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={revokePostAction.bind(null, post.id)}>
                    <SubmitButton variant="ghost" size="sm" pendingText="…">
                      Freigabe zurücknehmen
                    </SubmitButton>
                  </ActionForm>
                </div>
              ) : null}

              {post.publishedAt ? <p>Veröffentlicht am {formatDateTime(post.publishedAt)} Uhr.</p> : null}

              {editable ? (
                <ActionForm action={deletePostAction.bind(null, post.id)}>
                  <SubmitButton variant="ghost" size="sm" className="text-red-700" pendingText="…">
                    Beitrag löschen
                  </SubmitButton>
                </ActionForm>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
