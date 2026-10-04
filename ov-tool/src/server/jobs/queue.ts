import "server-only";

// Kleine Indirektion, damit Services Jobs einstellen können, ohne den Runner (pg-boss) zu importieren.
type Handler = (data: Record<string, unknown>) => Promise<unknown>;
type Sender = (queue: string, data: Record<string, unknown>) => Promise<unknown>;

const handlers = new Map<string, Handler>();
let sender: Sender | null = null;

export function defineJob(queue: string, handler: Handler) {
  handlers.set(queue, handler);
}

export function jobHandlers() {
  return handlers;
}

export function setJobSender(s: Sender | null) {
  sender = s;
}

/** Job einstellen; ohne laufende Queue (Tests, JOBS_ENABLED=false) direkt im Hintergrund ausführen. */
export async function enqueue(queue: string, data: Record<string, unknown>) {
  if (sender) return sender(queue, data);
  if (!handlers.has(queue)) await import("./definitions");
  const h = handlers.get(queue);
  if (!h) throw new Error(`Unbekannte Queue: ${queue}`);
  if (process.env.VITEST) return h(data);
  void h(data).catch((err) => console.error(`[jobs] ${queue}:`, err));
}
