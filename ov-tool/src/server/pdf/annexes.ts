import "server-only";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { readStoredFile } from "@/server/files";

// Anlagen ans Protokoll-PDF anhängen: PDF-Seiten werden übernommen, Bilder auf A4-Seiten gesetzt.
// Jede Anlage erhält oben rechts den Vermerk „Anlage n“. Andere Dateitypen werden nur aufgeführt.

export type Annex = { nummer: number; name: string; mimeType: string; filePath: string };

const A4: [number, number] = [595.28, 841.89];
const RHOENDORF = rgb(0x2d / 255, 0x3c / 255, 0x4b / 255);

export function isMergeable(mimeType: string) {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}

export async function appendAnnexes(basePdf: Buffer, annexes: Annex[]): Promise<{ pdf: Buffer; merged: number[] }> {
  const mergeable = annexes.filter((a) => isMergeable(a.mimeType));
  if (mergeable.length === 0) return { pdf: basePdf, merged: [] };
  const doc = await PDFDocument.load(basePdf);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const merged: number[] = [];

  const stamp = (page: ReturnType<PDFDocument["addPage"]>, label: string) => {
    const { width, height } = page.getSize();
    const size = 9;
    const w = font.widthOfTextAtSize(label, size);
    page.drawRectangle({ x: width - w - 30, y: height - 30, width: w + 14, height: 16, color: rgb(1, 1, 1), opacity: 0.85 });
    page.drawText(label, { x: width - w - 23, y: height - 25, size, font, color: RHOENDORF });
  };

  for (const a of mergeable) {
    const label = `Anlage ${a.nummer}: ${a.name.length > 60 ? `${a.name.slice(0, 57)}…` : a.name}`;
    try {
      const data = await readStoredFile(a.filePath);
      if (a.mimeType === "application/pdf") {
        const src = await PDFDocument.load(data, { ignoreEncryption: true });
        const pages = await doc.copyPages(src, src.getPageIndices());
        pages.forEach((p, i) => {
          doc.addPage(p);
          if (i === 0) stamp(p, label);
        });
      } else {
        // Bilder normalisieren (WebP/HEIC-sicher, EXIF-Drehung) und auf A4 einpassen
        const png = await sharp(data).rotate().resize({ width: 2000, height: 2800, fit: "inside", withoutEnlargement: true }).png().toBuffer();
        const img = await doc.embedPng(png);
        const page = doc.addPage(A4);
        const margin = 40;
        const maxW = A4[0] - 2 * margin;
        const maxH = A4[1] - 2 * margin - 30;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: (A4[0] - w) / 2, y: margin + (maxH - h) / 2, width: w, height: h });
        stamp(page, label);
      }
      merged.push(a.nummer);
    } catch (err) {
      // beschädigte oder verschlüsselte Datei: nicht anhängen, bleibt als eigene Datei im Versand
      console.error(`Anlage ${a.nummer} (${a.name}) konnte nicht angehängt werden:`, err);
    }
  }
  return { pdf: Buffer.from(await doc.save()), merged };
}
