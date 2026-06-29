import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { addComment } from "@/lib/rfq-service";

const schema = z.object({
  type: z.enum(["INTERNAL", "SUPPLIER"]),
  body: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req);
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid comment", 422);
    const comment = await addComment(user, id, parsed.data.type, parsed.data.body);
    return ok({ comment }, { status: 201 });
  });
}
