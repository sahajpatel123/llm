import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, unauthorizedResponse } from "@/lib/auth";

export async function DELETE(req: Request, context: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    const threadId = context.params.id;

    const thread = await prisma.thread.findFirst({
      where: { id: threadId, userId: user.id },
      select: { id: true },
    });

    if (!thread) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    await prisma.thread.delete({ where: { id: threadId } });
    return NextResponse.json({ ok: true });
  } catch {
    return unauthorizedResponse();
  }
}
