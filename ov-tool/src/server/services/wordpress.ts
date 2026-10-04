import "server-only";

// WordPress-REST-API mit Anwendungspasswörtern (Benutzer → Profil → Anwendungspasswörter).
// Zugangsdaten nur als Umgebungsvariablen (CLAUDE.md Regel 8/20).

export type WordpressSiteKey = "SF" | "BBR";
export const SITE_LABELS: Record<WordpressSiteKey, string> = { SF: "cdu-sf.de", BBR: "bbr.cdu-sf.de" };

export function wordpressSite(key: WordpressSiteKey) {
  const url = process.env[`WP_${key}_URL`]?.trim().replace(/\/+$/, "");
  const user = process.env[`WP_${key}_USER`]?.trim();
  const appPassword = process.env[`WP_${key}_APP_PASSWORD`]?.trim();
  if (!url || !user || !appPassword) return null;
  return { key, url, user, appPassword };
}

export function wordpressSites() {
  return (Object.keys(SITE_LABELS) as WordpressSiteKey[]).map((k) => ({ key: k, label: SITE_LABELS[k], configured: !!wordpressSite(k) }));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Einfacher Blogtext (Absätze, „## “-Überschriften) → WordPress-Blockmarkup. */
export function blogToHtml(body: string): string {
  return body
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) =>
      b.startsWith("## ")
        ? `<!-- wp:heading -->\n<h2 class="wp-block-heading">${esc(b.slice(3).trim())}</h2>\n<!-- /wp:heading -->`
        : `<!-- wp:paragraph -->\n<p>${esc(b).replace(/\n/g, "<br>")}</p>\n<!-- /wp:paragraph -->`,
    )
    .join("\n\n");
}
