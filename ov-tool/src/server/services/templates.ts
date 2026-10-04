import "server-only";
import Handlebars from "handlebars";
import type { User } from "@prisma/client";
import { formToObject, z } from "@/lib/validation";
import { assertCan } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { NotFoundError, UserError } from "@/server/errors";
import { appUrl } from "@/server/ov";
import { wrapDocument } from "@/server/pdf/render";
import { findUnknownPlaceholders, parseFrontMatter, renderHtml, renderMailTemplate, renderText } from "@/server/templates/engine";
import { readTemplateFile } from "@/server/templates/files";
import { KNOWN_PLACEHOLDERS } from "@/server/templates/placeholders";
import { TEMPLATE_DEFS, templateDef, type TemplateDef } from "@/server/templates/registry";
import { sampleContext } from "@/server/templates/sample-context";
import { buildDefaultAgenda, parseStandardAgenda } from "./agenda-defaults";

type Actor = Pick<User, "id" | "role">;

export async function listTemplates(actor: Actor) {
  assertCan(actor, "templates.manage");
  const rows = await db.template.findMany({
    where: { active: true },
    include: { createdBy: { select: { name: true } } },
  });
  return TEMPLATE_DEFS.map((def) => ({ def, active: rows.find((r) => r.key === def.key) ?? null }));
}

export async function getTemplateEditor(actor: Actor, key: string) {
  assertCan(actor, "templates.manage");
  let def: TemplateDef;
  try {
    def = templateDef(key);
  } catch {
    throw new NotFoundError("Vorlage nicht gefunden.");
  }
  const versions = await db.template.findMany({
    where: { key },
    orderBy: { version: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  const body = versions.find((v) => v.active)?.body ?? (await readTemplateFile(key));
  return { def, body, versions };
}

function handlebarsError(source: string): string | null {
  try {
    Handlebars.parse(source);
    return null;
  } catch (err) {
    return (err as Error).message.split("\n")[0] ?? "Syntaxfehler";
  }
}

/** Prüft eine Vorlage: Syntax, Pflichtangaben, unbekannte Platzhalter. Gibt Fehlermeldungen zurück. */
export function validateTemplate(def: TemplateDef, body: string): string[] {
  const errors: string[] = [];
  if (def.kind === "json") {
    try {
      const agenda = parseStandardAgenda(body);
      for (const top of agenda.tops) {
        if (top.titel) {
          const unknown = findUnknownPlaceholders(top.titel, KNOWN_PLACEHOLDERS);
          if (unknown.length) errors.push(`Unbekannte Platzhalter in „${top.titel}“: ${unknown.join(", ")}`);
        }
      }
    } catch (err) {
      errors.push(`Ungültiges JSON: ${(err as Error).message}`);
    }
    return errors;
  }
  const syntax = handlebarsError(body);
  if (syntax) return [`Syntaxfehler: ${syntax}`];
  if (def.kind === "mail") {
    const { meta } = parseFrontMatter(body);
    if (!meta.betreff) errors.push("Der Kopfbereich mit „betreff:“ fehlt (--- betreff: … ---).");
    else if (handlebarsError(meta.betreff)) errors.push("Syntaxfehler im Betreff.");
  }
  const unknown = findUnknownPlaceholders(body, KNOWN_PLACEHOLDERS);
  if (unknown.length) errors.push(`Unbekannte Platzhalter: ${unknown.join(", ")}`);
  return errors;
}

const saveSchema = z.object({ body: z.string().min(1, { error: "Die Vorlage ist leer." }).max(200_000) });

export async function saveTemplate(actor: Actor, key: string, formData: FormData) {
  assertCan(actor, "templates.manage");
  const def = templateDef(key);
  const { body } = saveSchema.parse(formToObject(formData));
  const normalized = body.replace(/\r\n/g, "\n");
  const errors = validateTemplate(def, normalized);
  if (errors.length) throw new UserError(errors.join(" "));
  return createVersion(actor, def, normalized, "template.update");
}

async function createVersion(actor: Actor, def: TemplateDef, body: string, action: string, extra?: object) {
  return db.$transaction(async (tx) => {
    const current = await tx.template.findFirst({ where: { key: def.key, active: true } });
    if (current?.body === body) throw new UserError("Keine Änderung gegenüber der aktiven Fassung.");
    const last = await tx.template.aggregate({ where: { key: def.key }, _max: { version: true } });
    await tx.template.updateMany({ where: { key: def.key }, data: { active: false } });
    const created = await tx.template.create({
      data: { key: def.key, name: def.name, body, version: (last._max.version ?? 0) + 1, active: true, createdById: actor.id },
    });
    await audit(tx, actor, action, "Template", def.key, { version: created.version, ...extra });
    return created;
  });
}

export async function restoreTemplateVersion(actor: Actor, key: string, version: number) {
  assertCan(actor, "templates.manage");
  const def = templateDef(key);
  const old = await db.template.findUnique({ where: { key_version: { key, version } } });
  if (!old) throw new NotFoundError("Version nicht gefunden.");
  return createVersion(actor, def, old.body, "template.restore", { from: version });
}

/** Auf Ausgangsfassung aus templates/ zurücksetzen (als neue Version). */
export async function resetTemplate(actor: Actor, key: string) {
  assertCan(actor, "templates.manage");
  const def = templateDef(key);
  return createVersion(actor, def, await readTemplateFile(key), "template.reset");
}

export type TemplatePreview =
  | { kind: "mail"; subject: string; text: string }
  | { kind: "html"; html: string }
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "error"; errors: string[] };

/** Vorschau mit erfundenen Beispieldaten. */
export async function previewTemplate(actor: Actor, key: string, body: string): Promise<TemplatePreview> {
  assertCan(actor, "templates.manage");
  const def = templateDef(key);
  const errors = validateTemplate(def, body);
  if (errors.length) return { kind: "error", errors };
  const ctx = sampleContext(appUrl());
  try {
    switch (def.kind) {
      case "mail": {
        const m = renderMailTemplate(body, ctx);
        return { kind: "mail", subject: m.subject, text: m.text };
      }
      case "dokument":
        return { kind: "html", html: await wrapDocument(renderHtml(body, ctx), def.name) };
      case "prompt":
        return { kind: "text", text: renderText(body, ctx) };
      case "json": {
        const items = buildDefaultAgenda(parseStandardAgenda(body), {
          minutesToApprove: [{ id: "x", meetingDate: ctx.letztesProtokoll.sitzungsdatum }],
          overdueTasks: [{ title: "Beispielaufgabe", responsible: "Muster", due: "01.11.2026" }],
          topics: [{ id: "t", title: "Beispielthema „für nächste Sitzung“" }],
        });
        return {
          kind: "list",
          items: items.flatMap((i, n) => [`${n + 1}  ${i.title}`, ...i.children.map((c, k) => `    ${n + 1}.${k + 1}  ${c.title}`)]),
        };
      }
    }
  } catch (err) {
    return { kind: "error", errors: [(err as Error).message] };
  }
}
