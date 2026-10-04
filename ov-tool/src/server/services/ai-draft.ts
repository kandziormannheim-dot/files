import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { renderText } from "@/server/templates/engine";
import { getTemplateSource } from "@/server/templates/store";
import { ovContext } from "@/server/ov";

// Protokollentwurf aus einem Transkript über die Claude API (SPEC.md 3.4). Nur Text verlässt den Server.
// Das Ergebnis ist immer nur ein Vorschlag (CLAUDE.md Regel 7).

const nullableString = z.string().nullable();

export const draftSchema = z.object({
  formalia: z.object({
    eroeffnung: nullableString,
    beschlussfaehig: z.boolean().nullable(),
    wiedereroeffnung: nullableString,
    tagesordnung: nullableString,
    letztesProtokoll: nullableString,
    eroeffnetUm: nullableString,
    geschlossenUm: nullableString,
  }),
  abschnitte: z.array(
    z.object({
      topNummer: z.string(),
      status: z.enum(["BEHANDELT", "ABGESETZT", "VERTAGT"]),
      punkte: z.array(z.object({ text: z.string(), unterpunkte: z.array(z.string()) })),
      ergebnis: z.object({ art: z.enum(["BESCHLUSS", "ERGEBNIS"]), text: z.string() }).nullable(),
    }),
  ),
  beschluesse: z.array(
    z.object({
      topNummer: z.string(),
      gegenstand: z.string(),
      ergebnisart: z.enum([
        "ANGENOMMEN_EINSTIMMIG",
        "ANGENOMMEN_MEHRHEITLICH",
        "ABGELEHNT",
        "FESTGESTELLT",
        "ABGESETZT",
        "VERTAGT",
        "KENNTNISNAHME",
      ]),
      ja: z.number().int().nullable(),
      nein: z.number().int().nullable(),
      enthaltung: z.number().int().nullable(),
    }),
  ),
  aufgaben: z.array(
    z.object({
      titel: z.string(),
      topNummer: nullableString,
      verantwortlich: z.array(z.string()),
      fristDatum: nullableString,
      fristText: nullableString,
    }),
  ),
  verschiedenes: z.array(z.string()),
  unsicherheiten: z.array(z.string()),
});

export type MinutesDraft = z.infer<typeof draftSchema>;

export type DraftInput = {
  agenda: { number: string; title: string }[];
  attendance: { name: string; funktion: string; status: string }[];
  transcript: string;
};

export function buildUserMessage(input: DraftInput): string {
  return [
    "<tagesordnung>",
    ...input.agenda.map((a) => `TOP ${a.number}  ${a.title}`),
    "</tagesordnung>",
    "",
    "<anwesenheitsliste>",
    ...input.attendance.map((a) => `${a.name}${a.funktion ? ` (${a.funktion})` : ""} – ${a.status}`),
    "</anwesenheitsliste>",
    "",
    "<transkript>",
    input.transcript,
    "</transkript>",
    "",
    "Erstelle den Protokollentwurf nach den Vorgaben als JSON.",
  ].join("\n");
}

/** Modelle, die den serverseitigen Rückfall bei Ablehnungen („fallbacks: default“) unterstützen. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

export function draftModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5";
}

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export class DraftRefusedError extends Error {}

export async function generateDraft(input: DraftInput, client = new Anthropic()): Promise<MinutesDraft> {
  const { source } = await getTemplateSource("prompt.protokoll");
  const system = renderText(source, { ov: await ovContext() });
  const model = draftModel();
  const useFallback = FALLBACK_MODELS.has(model) && process.env.ANTHROPIC_FALLBACKS !== "off";
  const response = await client.beta.messages.parse(
    {
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: buildUserMessage(input) }],
      output_config: { effort: "high", format: betaZodOutputFormat(draftSchema) },
      ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    },
    { timeout: 15 * 60_000 },
  );
  if (response.stop_reason === "refusal") {
    throw new DraftRefusedError(`Die KI hat den Entwurf abgelehnt (${response.stop_details?.category ?? "ohne Angabe"}).`);
  }
  if (response.stop_reason === "max_tokens") throw new Error("Der Entwurf wurde abgeschnitten (Transkript zu lang).");
  if (!response.parsed_output) throw new Error("Die Antwort der KI konnte nicht gelesen werden.");
  return response.parsed_output;
}
