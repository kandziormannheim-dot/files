import "server-only";
import { readTemplateFile } from "./files";

/** Aktuelle Fassung einer Vorlage. (Paket 1.6 ergänzt die versionierte Ablage in der DB.) */
export async function getTemplateSource(key: string): Promise<{ source: string; version: number }> {
  return { source: await readTemplateFile(key), version: 0 };
}
