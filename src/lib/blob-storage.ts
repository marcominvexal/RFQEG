import { get, put } from "@vercel/blob";

const DB_PATH = "rfq-portal/database.json";

export function blobEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function readText(pathname: string): Promise<string | null> {
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return new Response(result.stream).text();
}

export async function writeText(pathname: string, content: string): Promise<void> {
  await put(pathname, content, {
    access: "private",
    contentType: "application/json",
  });
}

export async function readBytes(pathname: string): Promise<Buffer | null> {
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const ab = await new Response(result.stream).arrayBuffer();
  return Buffer.from(ab);
}

export async function writeBytes(pathname: string, data: Buffer, contentType: string): Promise<void> {
  await put(pathname, data, {
    access: "private",
    contentType,
  });
}

export function attachmentPath(key: string): string {
  return `rfq-portal/attachments/${key}`;
}

export { DB_PATH };
