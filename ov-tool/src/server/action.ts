import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { UserError } from "./errors";

/**
 * Einheitliche Fehlerbehandlung für Server Actions: Validierungsfehler je Feld,
 * Nutzerfehler als Meldung, alles andere generisch (Details nur im Server-Log).
 */
export async function runAction(
  fn: () => Promise<string | { message?: string; data?: Record<string, unknown> } | void>,
): Promise<ActionState> {
  try {
    const result = await fn();
    if (typeof result === "string") return { ok: true, message: result };
    return { ok: true, ...(result ?? {}) };
  } catch (err) {
    unstable_rethrow(err); // redirect()/notFound() durchreichen
    if (err instanceof z.ZodError) {
      return {
        ok: false,
        error: "Bitte die markierten Felder prüfen.",
        fieldErrors: z.flattenError(err).fieldErrors as Record<string, string[]>,
      };
    }
    if (err instanceof UserError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Es ist ein unerwarteter Fehler aufgetreten." };
  }
}
