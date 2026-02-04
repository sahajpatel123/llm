import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, unauthorizedResponse } from "@/lib/auth";

const MAX_MESSAGE_LENGTH = 8000;

function getThreadId(req: Request) {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const threadIndex = segments.indexOf("threads");
  return threadIndex >= 0 ? segments[threadIndex + 1] ?? "" : "";
}

export async function GET(req: Request) {
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

    const messages = await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, messages });
  } catch {
    return unauthorizedResponse();
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const threadId = getThreadId(req);
    const body = (await req.json().catch(() => null)) as { content?: string } | null;
    const content = body?.content?.trim() ?? "";

    if (!threadId) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const thread = await prisma.thread.findFirst({
      where: { id: threadId, userId: user.id },
      select: { id: true },
    });

    if (!thread) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    // TODO: enforce plan usage limits before creating messages.

    const message = await prisma.message.create({
      data: {
        threadId,
        userId: user.id,
        role: "user",
        content,
      },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    await prisma.thread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ ok: true, message });
  } catch {
    return unauthorizedResponse();
  }
}
