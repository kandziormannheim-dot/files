import "server-only";
import sharp from "sharp";
import { sniffType } from "@/lib/file-types";
import { UserError } from "@/server/errors";

const MAX_UPLOAD = 15_000_000;

/**
 * Foto für öffentliche/geteilte Nutzung aufbereiten: Typ prüfen, nach EXIF drehen, auf 1600 px verkleinern
 * und als WebP neu kodieren – dabei fallen alle Metadaten (GPS, Kamera) weg.
 */
export async function normalizePhoto(file: File): Promise<Buffer> {
  if (file.size === 0) throw new UserError("Bitte ein Foto auswählen.");
  if (file.size > MAX_UPLOAD) throw new UserError("Das Foto ist größer als 15 MB.");
  const data = Buffer.from(await file.arrayBuffer());
  const type = sniffType(data);
  if (type !== "image/jpeg" && type !== "image/png" && type !== "image/webp") {
    throw new UserError("Nur JPEG-, PNG- oder WebP-Fotos sind erlaubt (iPhone: Einstellungen → Kamera → Formate → „Maximale Kompatibilität“).");
  }
  return sharp(data).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
}
