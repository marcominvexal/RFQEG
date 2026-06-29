import { NextRequest, NextResponse } from "next/server";
import archiver from "archiver";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readObject } from "@/lib/storage";

export const runtime = "nodejs";

/** Download all attachments for an RFQ as a single ZIP. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req).catch(() => null);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;

  const rfq = await prisma.rfq.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
    include: { attachments: { where: { deletedAt: null } } },
  });
  if (!rfq) return new NextResponse("Not found", { status: 404 });
  if (!rfq.attachments.length) return new NextResponse("No attachments", { status: 409 });

  const archive = archiver("zip", { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  const done = new Promise<void>((resolve, reject) => {
    archive.on("data", (c: Buffer) => chunks.push(c));
    archive.on("end", () => resolve());
    archive.on("error", reject);
  });

  for (const att of rfq.attachments) {
    const data = await readObject(att.storageKey).catch(() => null);
    if (data) archive.append(data, { name: att.fileName });
  }
  await archive.finalize();
  await done;

  const buffer = Buffer.concat(chunks);
  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${rfq.rfqNumber}-attachments.zip"`,
    },
  });
}
