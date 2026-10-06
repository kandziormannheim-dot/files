import "server-only";
import { parseCardDescription, type Bezirk } from "@/lib/bbr-card";

// Lesender Zugriff auf Nextcloud Deck (REST-API v1.0) mit einem eigenen Dienstnutzer und App-Passwort.
// Zugangsdaten ausschließlich aus Umgebungsvariablen (CLAUDE.md Regel 8):
//   NEXTCLOUD_URL, NEXTCLOUD_DECK_USER, NEXTCLOUD_DECK_APP_PASSWORD
// Der Dienstnutzer sollte das BBR-Board nur lesend geteilt bekommen.

export type DeckCard = {
  cardId: number;
  boardId: number;
  boardTitle: string;
  stack: string;
  title: string;
  kurzfassung: string;
  bezirk: Bezirk | null;
  url: string;
  modifiedAt: Date | null;
};

type RawBoard = { id: number; title: string; archived?: boolean; deletedAt?: number };
type RawCard = { id: number; title: string; description?: string | null; archived?: boolean; deletedAt?: number; lastModified?: number };
type RawStack = { id: number; title: string; cards?: RawCard[] | null; deletedAt?: number };

export function deckConfig() {
  const url = (process.env.NEXTCLOUD_URL ?? "").replace(/\/+$/, "");
  const user = process.env.NEXTCLOUD_DECK_USER ?? "";
  const password = process.env.NEXTCLOUD_DECK_APP_PASSWORD ?? "";
  return url && user && password ? { url, user, password } : null;
}

export function deckConfigured() {
  return deckConfig() !== null;
}

/** Board-Filter aus der Einstellung (Titel oder IDs, je Zeile oder durch Komma getrennt; leer = alle sichtbaren Boards). */
export function boardMatcher(filter: string) {
  const wanted = filter
    .split(/[\n,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return (b: { id: number; title: string }) => wanted.length === 0 || wanted.includes(String(b.id)) || wanted.includes(b.title.trim().toLowerCase());
}

export class DeckError extends Error {}

export async function fetchDeckCards(boardFilter: string, fetchImpl: typeof fetch = fetch): Promise<DeckCard[]> {
  const cfg = deckConfig();
  if (!cfg) throw new DeckError("Nextcloud-Zugang ist nicht eingerichtet (NEXTCLOUD_URL, NEXTCLOUD_DECK_USER, NEXTCLOUD_DECK_APP_PASSWORD).");
  const headers = {
    Accept: "application/json",
    "OCS-APIRequest": "true",
    Authorization: `Basic ${Buffer.from(`${cfg.user}:${cfg.password}`).toString("base64")}`,
  };
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetchImpl(`${cfg.url}/index.php/apps/deck/api/v1.0${path}`, { headers, signal: AbortSignal.timeout(30_000) });
    if (res.status === 401 || res.status === 403) throw new DeckError("Nextcloud hat den Zugang abgelehnt – App-Passwort oder Freigabe des Boards prüfen.");
    if (!res.ok) throw new DeckError(`Nextcloud Deck antwortet mit HTTP ${res.status}.`);
    return (await res.json()) as T;
  };

  const match = boardMatcher(boardFilter);
  const boards = (await get<RawBoard[]>("/boards")).filter((b) => !b.archived && !b.deletedAt && match(b));
  const cards: DeckCard[] = [];
  for (const board of boards) {
    const stacks = await get<RawStack[]>(`/boards/${board.id}/stacks`);
    for (const stack of stacks) {
      if (stack.deletedAt) continue;
      for (const c of stack.cards ?? []) {
        if (c.archived || c.deletedAt) continue;
        const parsed = parseCardDescription(c.description ?? "", board.title, stack.title, c.title);
        if (!parsed.kurzfassung) continue;
        cards.push({
          cardId: c.id,
          boardId: board.id,
          boardTitle: board.title,
          stack: stack.title,
          title: c.title.trim().slice(0, 300),
          kurzfassung: parsed.kurzfassung,
          bezirk: parsed.bezirk,
          url: `${cfg.url}/index.php/apps/deck/board/${board.id}/card/${c.id}`,
          modifiedAt: c.lastModified ? new Date(c.lastModified * 1000) : null,
        });
      }
    }
  }
  return cards;
}
