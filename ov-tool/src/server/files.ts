import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// Dateiablage auf dem lokalen Volume (SPEC.md 5: Dateien). Pfade in der DB sind relativ zu FILE_STORAGE_PATH.

export function storageRoot(): string {
  return process.env.FILE_STORAGE_PATH || path.join(process.cwd(), "data", "files");
}

function resolveSafe(relPath: string): string {
  const root = path.resolve(storageRoot());
  const full = path.resolve(root, relPath);
  if (!full.startsWith(root + path.sep)) throw new Error("Ungültiger Dateipfad");
  return full;
}

export async function saveFile(dir: string, originalName: string, data: Buffer): Promise<string> {
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  const rel = path.join(dir, `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`);
  const full = resolveSafe(rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return rel;
}

export async function readStoredFile(relPath: string): Promise<Buffer> {
  return readFile(resolveSafe(relPath));
}

export async function deleteStoredFile(relPath: string | null | undefined): Promise<void> {
  if (!relPath) return;
  await rm(resolveSafe(relPath), { force: true });
}

export async function storedFileExists(relPath: string | null | undefined): Promise<boolean> {
  if (!relPath) return false;
  try {
    return (await stat(resolveSafe(relPath))).isFile();
  } catch {
    return false;
  }
}

export function absoluteStoredPath(relPath: string): string {
  return resolveSafe(relPath);
}

const MIME_BY_EXT: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

export async function readSignatureDataUri(relPath: string | null | undefined): Promise<string | undefined> {
  if (!relPath || !(await storedFileExists(relPath))) return undefined;
  const mime = MIME_BY_EXT[path.extname(relPath).toLowerCase()] ?? "image/png";
  return `data:${mime};base64,${(await readStoredFile(relPath)).toString("base64")}`;
}
