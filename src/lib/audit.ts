import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

interface AuditInput {
  actorId?: string | null;
  entity: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  req?: NextRequest;
}

/** Append-only audit log. Never throws into the request path. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        before: (input.before as any) ?? undefined,
        after: (input.after as any) ?? undefined,
        ip: input.req?.headers.get("x-forwarded-for") ?? undefined,
        userAgent: input.req?.headers.get("user-agent") ?? undefined,
      },
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

/** Convenience for writing an RFQ timeline Activity. */
export async function logActivity(
  rfqId: string,
  type: any,
  message: string,
  actorId?: string | null,
  meta?: unknown
) {
  try {
    await prisma.activity.create({
      data: { rfqId, type, message, actorId: actorId ?? null, meta: (meta as any) ?? undefined },
    });
  } catch (e) {
    console.error("activity log failed", e);
  }
}
