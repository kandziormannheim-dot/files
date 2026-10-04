// Schutz gegen versehentlich gespeicherte Zugangsdaten (CLAUDE.md Regel 5, SPEC.md 3.9).

const CREDENTIAL_PATTERN =
  /\b(passw(?:or)?t|password|passwd|kennwort|pw|pin|zugangsdaten|login-?daten|token|api-?key|secret)\b\s*[:=]\s*\S+/i;

/** Text sieht nach „Passwort: geheim“ o. Ä. aus. */
export function looksLikeCredential(text: string | null | undefined): boolean {
  return !!text && CREDENTIAL_PATTERN.test(text);
}

/** URL enthält Benutzername/Passwort (https://user:pass@host) oder einen Token-Parameter. */
export function urlContainsCredentials(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.username || u.password) return true;
    for (const key of u.searchParams.keys()) {
      if (/^(pass(word)?|pw|pwd|token|access_token|api_?key|secret)$/i.test(key)) return true;
    }
    return false;
  } catch {
    return false;
  }
}
