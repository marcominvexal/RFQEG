import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Object-storage abstraction. Default adapter writes to the local filesystem
 * (./storage). Swap `save/read/remove` for S3/MinIO without touching callers.
 */

const ROOT = path.resolve(process.cwd(), process.env.STORAGE_DIR || "storage");

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
}

/** Build a deterministic-ish storage key for an attachment. */
export function buildKey(orgId: string, rfqId: string, fileName: string): string {
  return `${orgId}/${rfqId}/${crypto.randomUUID()}-${safeName(fileName)}`;
}

export async function saveObject(key: string, data: Buffer): Promise<void> {
  const full = path.join(ROOT, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function readObject(key: string): Promise<Buffer> {
  return fs.readFile(path.join(ROOT, key));
}

export async function removeObject(key: string): Promise<void> {
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
