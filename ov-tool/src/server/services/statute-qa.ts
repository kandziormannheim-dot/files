import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Role } from "@prisma/client";
import { z as z4 } from "zod/v4";
import data from "@/data/statutes.json";
import { citation, findSection, searchStatutes, type StatuteData } from "@/lib/statute-search";
import { assertCan } from "@/server/auth/permissions";
import { UserError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { aiConfigured, draftModel } from "./ai-draft";

// Satzungs-Assistent (SPEC.md 3.14): Claude antwortet ausschließlich auf Grundlage der gefundenen Paragraphen.

export const statutes = data as StatuteData;

export const DISCLAIMER = "Auslegungshilfe, keine Rechtsberatung – im Zweifel die Kreisgeschäftsstelle fragen.";

const answerSchema = z4.object({
  answer: z4.string().describe("Antwort auf Deutsch, knapp, mit Fundstellen in Klammern, z. B. (LV-Satzung § 50 Abs. 2)"),
  sources: z4
    .array(z4.object({ ref: z4.string().describe("Kennung aus den Auszügen, z. B. lv-satzung:50"), absatz: z4.string().nullable() }))
    .describe("Tatsächlich verwendete Auszüge"),
  covered: z4.boolean().describe("false, wenn die Auszüge die Frage nicht beantworten"),
});

export type StatuteAnswer = {
  answer: string;
  covered: boolean;
  sources: { docId: string; num: string; absatz: string | null; label: string; stand: string }[];
};

const SYSTEM = `Du bist der Satzungs-Assistent des CDU-Ortsverbands Seckenheim-Friedrichsfeld (Kreisverband Mannheim, Landesverband Baden-Württemberg).
Du beantwortest Fragen des Vorstands ausschließlich auf Grundlage der mitgelieferten Satzungsauszüge in <auszuege>.

Regeln:
- Nutze nur die Auszüge. Kein Wissen von außerhalb, keine Vermutungen über andere Satzungen (z. B. des Kreisverbands).
- Rangfolge: Für den Ortsverband gilt die Satzung der CDU Baden-Württemberg (LV-Satzung), soweit sie etwas regelt; sonst das Statut der CDU Deutschlands (Statut § 50). Das Parteiengesetz geht beiden vor.
- Nenne zu jeder Aussage die Fundstelle (Ordnung, §, Absatz), z. B. „(LV-Satzung § 50 Abs. 2)“.
- Wenn die Auszüge die Frage nicht oder nur teilweise beantworten, sage das klar und setze covered=false. Erfinde nichts.
- Antworte knapp und praktisch (2–6 Sätze, bei Abläufen gern nummeriert), sachlich und neutral, auf Deutsch.
- Keine Rechtsberatung; der Hinweis dazu wird automatisch ergänzt, wiederhole ihn nicht.`;

export function retrieveForQuestion(question: string, limit = 8) {
  return searchStatutes(statutes, question, { limit }).map((hit) => {
    const found = findSection(statutes, hit.docId, hit.num)!;
    return { hit, ...found };
  });
}

export function buildContext(question: string) {
  const found = retrieveForQuestion(question);
  const excerpts = found
    .map(({ doc, section }) => {
      const body = section.absaetze.map((a) => (a.nr ? `(${a.nr}) ${a.text}` : a.text)).join("\n");
      return `<auszug ref="${doc.id}:${section.num}" fundstelle="${citation(doc, section)}" ordnung="${doc.title}" stand="${doc.stand}">\n§ ${section.num} ${section.title}\n${body}\n</auszug>`;
    })
    .join("\n\n");
  return { found, prompt: `<auszuege>\n${excerpts}\n</auszuege>\n\n<frage>${question}</frage>` };
}

export async function askStatute(actor: { id: string; role: Role }, question: string, client?: Anthropic): Promise<StatuteAnswer> {
  assertCan(actor, "statute.ask");
  const q = question.trim();
  if (q.length < 8) throw new UserError("Bitte die Frage etwas ausführlicher stellen.");
  if (q.length > 1000) throw new UserError("Die Frage ist zu lang (höchstens 1000 Zeichen).");
  if (!aiConfigured()) throw new UserError("Für den Assistenten ist kein ANTHROPIC_API_KEY hinterlegt. Die Suche funktioniert trotzdem.");
  if (!rateLimit(`statute-qa:${actor.id}`, 20, 60 * 60_000)) throw new UserError("Zu viele Fragen in kurzer Zeit. Bitte später erneut versuchen.");

  const { found, prompt } = buildContext(q);
  if (found.length === 0) {
    return { answer: "Zu dieser Frage habe ich in Statut und Landessatzung keine passenden Paragraphen gefunden. Bitte anders formulieren oder die Suche nutzen.", covered: false, sources: [] };
  }
  const response = await (client ?? new Anthropic()).beta.messages.parse(
    {
      model: draftModel(),
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
      output_config: { effort: "medium", format: betaZodOutputFormat(answerSchema) },
    },
    { timeout: 2 * 60_000 },
  );
  if (response.stop_reason === "refusal") throw new UserError("Der Assistent hat die Frage nicht beantwortet. Bitte anders formulieren.");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Die Antwort der KI konnte nicht gelesen werden.");

  const sources: StatuteAnswer["sources"] = [];
  for (const s of parsed.sources) {
    const [docId, num] = s.ref.split(":");
    const f = docId && num ? found.find((x) => x.doc.id === docId && x.section.num === num) : undefined;
    if (!f || sources.some((x) => x.docId === f.doc.id && x.num === f.section.num)) continue;
    sources.push({ docId: f.doc.id, num: f.section.num, absatz: s.absatz, label: citation(f.doc, f.section, s.absatz), stand: f.doc.stand });
  }
  return { answer: parsed.answer, covered: parsed.covered, sources };
}
