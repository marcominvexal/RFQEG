import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  attachmentPath,
  blobEnabled,
  readBytes,
  writeBytes,
} from "@/lib/blob-storage";

const ROOT = path.resolve(process.cwd(), process.env.STORAGE_DIR || "storage");

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
}

export function buildKey(orgId: string, rfqId: string, fileName: string): string {
  return `${orgId}/${rfqId}/${crypto.randomUUID()}-${safeName(fileName)}`;
}

export async function saveObject(key: string, data: Buffer): Promise<void> {
  if (blobEnabled()) {
    await writeBytes(attachmentPath(key), data, "application/octet-stream");
    return;
  }
  const full = path.join(ROOT, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function readObject(key: string): Promise<Buffer> {
  if (blobEnabled()) {
    const buf = await readBytes(attachmentPath(key));
    if (!buf) throw new Error(`Attachment not found: ${key}`);
    return buf;
  }
  return fs.readFile(path.join(ROOT, key));
}

export async function removeObject(key: string): Promise<void> {
  if (blobEnabled()) {
    const { del } = await import("@vercel/blob");
    await del(attachmentPath(key)).catch(() => {});
    return;
  }
  await fs.unlink(path.join(ROOT, key)).catch(() => {});
}

export const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.ms-outlook": "msg",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "text/plain": "txt",
  "image/png": "png",
  "image/jpeg": "jpg",
};

export function isAllowed(mime: string, fileName: string): boolean {
  if (ALLOWED_MIME[mime]) return true;
  return /\.(pdf|docx?|xlsx?|msg|zip|txt|png|jpe?g)$/i.test(fileName);
}
