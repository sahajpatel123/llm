import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, unauthorizedResponse } from "@/lib/auth";

function getThreadId(req: Request) {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const threadIndex = segments.indexOf("threads");
  return threadIndex >= 0 ? segments[threadIndex + 1] ?? "" : "";
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser(req);
    const threadId = getThreadId(req);

    if (!threadId) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

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
