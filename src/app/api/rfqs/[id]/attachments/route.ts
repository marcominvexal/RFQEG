import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildKey, saveObject, isAllowed } from "@/lib/storage";
import { extractText } from "@/lib/extract-text";
import { logActivity } from "@/lib/audit";

export const runtime = "nodejs";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/** Upload an attachment (multipart/form-data, field "file"). Both roles may upload. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req);
    const { id } = await params;

    const rfq = await prisma.rfq.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null } });
    if (!rfq) return fail("RFQ not found", 404);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("No file provided", 422);
    if (file.size > MAX_BYTES) return fail("File exceeds 25 MB limit", 413);
    if (!isAllowed(file.type, file.name)) return fail(`Unsupported file type: ${file.type || file.name}`, 415);

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = buildKey(user.organizationId, id, file.name);
    await saveObject(key, buffer);

    const extractedText = await extractText(buffer, file.type, file.name);

    const attachment = await prisma.attachment.create({
      data: {
        rfqId: id,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        storageKey: key,
        extractedText,
        uploadedById: user.id,
      },
    });

    await logActivity(id, "ATTACHMENT_UPLOADED", `Attachment uploaded: ${file.name}`, user.id);

    return ok(
      { attachment: { ...attachment, extractedText: undefined } },
      { status: 201 }
    );
  });
}
