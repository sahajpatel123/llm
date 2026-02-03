import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, unauthorizedResponse } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

type VoteRequest = {
  duelId?: string;
  choice?: "A" | "B";
};

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const body = (await req.json().catch(() => null)) as VoteRequest | null;
    const duelId = body?.duelId ?? "";
    const choice = body?.choice === "B" ? "B" : body?.choice === "A" ? "A" : null;

    if (!duelId || !choice) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const duel = await prisma.duel.findFirst({
      where: { id: duelId, thread: { userId: user.id } },
      include: { thread: true },
    });

    if (!duel) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    if (duel.chosen) {
      const messages = await prisma.message.findMany({
        where: { threadId: duel.threadId },
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, createdAt: true },
      });

      return NextResponse.json({
        ok: true,
        thread: { id: duel.threadId, lockedProvider: duel.thread.lockedProvider },
        messages,
      });
    }

    const assistantContent = choice === "A" ? duel.optionA : duel.optionB;

    await prisma.$transaction(async (tx) => {
      await tx.duel.update({
        where: { id: duel.id },
        data: { chosen: choice },
      });

      await tx.thread.update({
        where: { id: duel.threadId },
        data: { lockedProvider: choice, updatedAt: new Date() },
      });

      await tx.message.create({
        data: {
          threadId: duel.threadId,
          userId: user.id,
          role: "assistant",
          content: assistantContent,
        },
      });
    });

    const messages = await prisma.message.findMany({
      where: { threadId: duel.threadId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, createdAt: true },
    });

    return NextResponse.json({
      ok: true,
      thread: { id: duel.threadId, lockedProvider: choice },
      messages,
    });
  } catch {
    return unauthorizedResponse();
  }
}
