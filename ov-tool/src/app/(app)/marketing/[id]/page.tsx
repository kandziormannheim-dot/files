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
import {
  approvePostAction,
  deletePostAction,
  markPublishedAction,
  revokePostAction,
  updatePostAction,
  wordpressAction,
} from "../actions";
import { MARKETING_STATUS } from "../labels";
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
  const site = wordpressSites().find((s) => s.key === (post.site ?? "SF"));
  const socialText = [post.body.trim(), post.hashtags.trim()].filter(Boolean).join("\n\n");
  const st = MARKETING_STATUS[post.status];

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
          description={`${post.kind === "BLOG" ? `Blogartikel für ${site?.label}` : "Social-Media-Beitrag"} · angelegt von ${post.createdBy?.name ?? "–"}${post.approvedBy ? ` · freigegeben von ${post.approvedBy.name}` : ""}`}
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
                  <Field label="Webseite" name="site">
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
                  <p className="mb-2 font-semibold">CDU Seckenheim-Friedrichsfeld</p>
                  <p className="whitespace-pre-wrap">{post.body || "–"}</p>
                  {post.hashtags ? <p className="mt-2 text-akzent-dunkel">{post.hashtags}</p> : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Freigabe &amp; Veröffentlichung</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {post.status === "ENTWURF" ? (
                publisher ? (
                  <ActionForm action={approvePostAction.bind(null, post.id)}>
                    <SubmitButton pendingText="…">Freigeben</SubmitButton>
                  </ActionForm>
                ) : (
                  <p className="text-neutral-600">Wartet auf Freigabe durch den Admin.</p>
                )
              ) : null}

              {post.status === "FREIGEGEBEN" && post.approvedAt ? (
                <p>Freigegeben am {formatDateTime(post.approvedAt)} Uhr.</p>
              ) : null}

              {post.kind === "SOCIAL" && post.status !== "ENTWURF" ? (
                <>
                  <ShareTools text={socialText} />
                  <p className="text-xs text-neutral-600">
                    Direktes automatisches Posten braucht die Meta-API mit Seitenfreigabe; bis dahin über Kopieren/Teilen oder die Meta
                    Business Suite einplanen.
                  </p>
                </>
              ) : null}

              {post.kind === "BLOG" && post.status !== "ENTWURF" ? (
                site?.configured ? (
                  post.status === "FREIGEGEBEN" && publisher ? (
                    <div className="flex flex-wrap gap-2">
                      <ActionForm action={wordpressAction.bind(null, post.id, "draft")}>
                        <SubmitButton variant="outline" pendingText="Wird übertragen …">
                          {post.wpPostId ? "WordPress-Entwurf aktualisieren" : "Als Entwurf an WordPress"}
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm action={wordpressAction.bind(null, post.id, "publish")}>
                        <SubmitButton pendingText="Wird veröffentlicht …">Direkt veröffentlichen</SubmitButton>
                      </ActionForm>
                    </div>
                  ) : null
                ) : (
                  <p className="text-neutral-600">
                    Für {site?.label} sind noch keine WordPress-Zugangsdaten hinterlegt. Bis dahin: Text kopieren und in WordPress einfügen.
                  </p>
                )
              ) : null}

              {post.kind === "BLOG" && post.status !== "ENTWURF" ? <ShareTools text={post.title} url={post.wpLink} /> : null}

              {post.wpLink ? (
                <p>
                  WordPress ({post.wpStatus === "publish" ? "veröffentlicht" : "Entwurf"}):{" "}
                  <a href={post.wpLink} target="_blank" rel="noopener noreferrer" className="underline">
                    {post.wpLink}
                  </a>
                </p>
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
