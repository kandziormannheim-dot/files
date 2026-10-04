import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { UserError } from "./errors";

// Verschlüsselung der Bürgerkontaktdaten (SPEC.md 3.8/6): AES-256-GCM, Schlüssel aus ENCRYPTION_KEY.
// Format: v1:<iv>:<tag>:<ciphertext> (Base64)

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) throw new UserError("Kontaktdaten können nicht gespeichert werden: ENCRYPTION_KEY ist nicht gesetzt.");
  const decoded = Buffer.from(raw, "base64");
  return decoded.length === 32 ? decoded : createHash("sha256").update(raw).digest();
}

export function encryptionConfigured(): boolean {
  return !!process.env.ENCRYPTION_KEY?.trim();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decrypt(token: string): string {
  const [v, iv, tag, data] = token.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unbekanntes Format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
