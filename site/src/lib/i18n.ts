/**
 * Sprachschicht.
 *
 * Deutsch ist die Standardsprache und liegt ohne Präfix unter `/`.
 * Englisch liegt unter `/en/`. Kein Query-Parameter, keine Subdomain — die
 * Begründung steht in INFORMATION_ARCHITECTURE.md unter „URL Strategy".
 *
 * Die englische Datei wird gegen die Struktur der deutschen typisiert. Fehlt
 * dort ein Schlüssel, schlägt `astro check` fehl, statt eine leere Stelle auf
 * der Seite zu hinterlassen.
 */
import de from "../content/de.json";
import en from "../content/en.json";

export type Lang = "de" | "en";

/** Die deutsche Datei ist die Referenzstruktur. */
export type Content = typeof de;

const dictionaries: Record<Lang, Content> = {
  de,
  en: en as Content,
};

export const languages: Lang[] = ["de", "en"];

export const languageNames: Record<Lang, string> = {
  de: "Deutsch",
  en: "English",
};

/** Kurzform für den Umschalter — bewusst zweistellig, nicht als Flagge. */
export const languageLabels: Record<Lang, string> = {
  de: "DE",
  en: "EN",
};

/** Inhalte für eine Sprache. */
export function content(lang: Lang): Content {
  return dictionaries[lang];
}

/**
 * Sprache aus einer URL ableiten. Alles unter `/en` ist Englisch, alles
 * andere Deutsch.
 */
export function langFromUrl(url: URL): Lang {
  const [, first] = url.pathname.split("/");
  return first === "en" ? "en" : "de";
}

/** Die jeweils andere Sprache. */
export function otherLang(lang: Lang): Lang {
  return lang === "de" ? "en" : "de";
}

/**
 * Pfad in der Zielsprache.
 *
 * Rechtstexte haben in beiden Sprachen eigene Slugs (`/impressum` gegenüber
 * `/en/imprint`), deshalb die Zuordnungstabelle. Alles, was hier nicht steht,
 * bekommt schlicht das Präfix vorangestellt oder abgenommen.
 */
const pathPairs: ReadonlyArray<readonly [string, string]> = [
  ["/", "/en/"],
  ["/impressum", "/en/imprint"],
  ["/datenschutz", "/en/privacy"],
];

export function translatePath(pathname: string, to: Lang): string {
  const clean = pathname.replace(/\.html$/, "");
  const normalised = clean.length > 1 ? clean.replace(/\/$/, "") : clean;

  for (const [dePath, enPath] of pathPairs) {
    const deNorm = dePath.length > 1 ? dePath.replace(/\/$/, "") : dePath;
    const enNorm = enPath.length > 1 ? enPath.replace(/\/$/, "") : enPath;
    if (normalised === deNorm) return to === "de" ? dePath : enPath;
    if (normalised === enNorm) return to === "de" ? dePath : enPath;
  }

  // Unbekannter Pfad: Präfix an- oder abhängen.
  if (to === "en") return normalised.startsWith("/en") ? normalised : `/en${normalised}`;
  return normalised.replace(/^\/en/, "") || "/";
}

/** Pfad mit Sprachpräfix, für interne Links innerhalb einer Sprache. */
export function localePath(path: string, lang: Lang): string {
  if (lang === "de") return path;
  return path === "/" ? "/en/" : `/en${path}`;
}

/**
 * Platzhalter in einem Textbaustein ersetzen: `{platform}`, `{email}` und so
 * weiter. Bewusst simpel — es geht um Einsetzungen, nicht um eine Template-
 * Sprache.
 */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key]! : match,
  );
}
