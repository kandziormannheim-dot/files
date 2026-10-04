import { z } from "zod";

// Deutsche Standardmeldungen für alle Schemas
z.config(z.locales.de());

export { z };

/** Leere Formularfelder als undefined behandeln. */
const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const optionalText = (max = 2000) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

export const requiredText = (max = 500) =>
  z.string({ error: "Pflichtfeld" }).trim().min(1, { error: "Pflichtfeld" }).max(max);

/** Checkbox: "on"/"true" → true, fehlt → false */
export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const optionalInt = z.preprocess(emptyToUndefined, z.coerce.number().int().optional());

export const email = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.email({ error: "Bitte eine gültige E-Mail-Adresse angeben." }),
);

export const optionalUrl = z.preprocess(
  emptyToUndefined,
  z
    .url({ protocol: /^https?$/, error: "Bitte eine vollständige Adresse mit https:// angeben." })
    .max(2000)
    .optional(),
);

/** FormData → Objekt (Mehrfachwerte werden zu Arrays). */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const all = formData.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = key.endsWith("[]") ? all : all[0];
  }
  return out;
}
