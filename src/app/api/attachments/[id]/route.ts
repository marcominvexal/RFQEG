import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { readObject, removeObject } from "@/lib/storage";
import { logActivity } from "@/lib/audit";

export const runtime = "nodejs";

async function loadOwned(userOrg: string, id: string) {
  const att = await prisma.attachment.findFirst({
    where: { id, deletedAt: null, rfq: { organizationId: userOrg } },
    include: { rfq: true },
  });
  return att;
}

/** Download / inline-preview an attachment (org-scoped). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req).catch(() => null);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const att = await loadOwned(user.organizationId, id);
  if (!att) return new NextResponse("Not found", { status: 404 });

  const data = await readObject(att.storageKey).catch(() => null);
  if (!data) return new NextResponse("File missing", { status: 410 });

  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(data as any, {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(att.fileName)}"`,
      "Content-Length": String(att.sizeBytes),
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req);
    const { id } = await params;
    const att = await loadOwned(user.organizationId, id);
    if (!att) return fail("Not found", 404);
    await prisma.attachment.update({ where: { id }, data: { deletedAt: new Date() } });
    await removeObject(att.storageKey);
    await logActivity(att.rfqId, "ATTACHMENT_UPLOADED", `Attachment removed: ${att.fileName}`, user.id);
    return ok({ ok: true });
  });
}
