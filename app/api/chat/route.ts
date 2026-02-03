import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, unauthorizedResponse } from "@/lib/auth";
import { getEffectivePlan, getPlanLimits } from "@/lib/subscription";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateFromProvider } from "@/lib/providerEngine";

const MAX_MESSAGE_LENGTH = 8000;

function getPeriodKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function getDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

type ChatMode = "exploration" | "verified";

type ChatRequest = {
  threadId?: string;
  content?: string;
  mode?: ChatMode;
};

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const body = (await req.json().catch(() => null)) as ChatRequest | null;
    const content = body?.content?.trim() ?? "";
    const mode = body?.mode === "verified" ? "verified" : "exploration";
    const requestedThreadId = body?.threadId ?? null;

    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const { plan } = await getEffectivePlan(user.id);
    const limits = getPlanLimits(plan);

    const now = new Date();
    const periodKey = getPeriodKey(now);
    const dayKey = getDayKey(now);

    const txResult = await prisma.$transaction(async (tx) => {
      let thread = requestedThreadId
        ? await tx.thread.findFirst({
            where: { id: requestedThreadId, userId: user.id },
          })
        : null;

      if (requestedThreadId && !thread) {
        throw new Error("thread_not_found");
      }

      if (!thread) {
        thread = await tx.thread.create({
          data: {
            userId: user.id,
            title: "New chat",
          },
        });
      }

      let ledger = await tx.usageLedger.findUnique({
        where: { userId_periodKey: { userId: user.id, periodKey } },
      });

      if (!ledger) {
        ledger = await tx.usageLedger.create({
          data: {
            userId: user.id,
            periodKey,
            verifiedDayKey: dayKey,
            messagesUsed: 0,
            verifiedUsed: 0,
            verifiedUsedToday: 0,
          },
        });
      } else if (ledger.verifiedDayKey !== dayKey) {
        ledger = await tx.usageLedger.update({
          where: { id: ledger.id },
          data: { verifiedDayKey: dayKey, verifiedUsedToday: 0 },
        });
      }

      if (ledger.messagesUsed >= limits.monthlyMessages) {
        throw new Error("quota_exceeded");
      }

      if (mode === "verified") {
        if (ledger.verifiedUsed >= limits.monthlyVerified) {
          throw new Error("verified_quota_exceeded");
        }
        if (ledger.verifiedUsedToday >= limits.dailyVerifiedMax) {
          throw new Error("verified_daily_limit");
        }
      }

      const userMessageCount = await tx.message.count({
        where: { threadId: thread.id, role: "user" },
      });

      const isFirstUserMessage = userMessageCount === 0;

      if (!isFirstUserMessage && !thread.lockedProvider) {
        throw new Error("thread_not_locked");
      }

      const updateData: {
        messagesUsed: { increment: number };
        verifiedUsed?: { increment: number };
        verifiedUsedToday?: { increment: number };
      } = {
        messagesUsed: { increment: 1 },
      };

      if (mode === "verified") {
        updateData.verifiedUsed = { increment: 1 };
        updateData.verifiedUsedToday = { increment: 1 };
      }

      await tx.usageLedger.update({ where: { id: ledger.id }, data: updateData });

      const userMessage = await tx.message.create({
        data: {
          threadId: thread.id,
          userId: user.id,
          role: "user",
          content,
        },
      });

      const title = isFirstUserMessage
        ? content.replace(/\s+/g, " ").trim().slice(0, 40) || "New chat"
        : thread.title;

      await tx.thread.update({
        where: { id: thread.id },
        data: {
          title: isFirstUserMessage ? title : undefined,
          updatedAt: now,
        },
      });

      return {
        threadId: thread.id,
        title,
        lockedProvider: thread.lockedProvider,
        userMessageId: userMessage.id,
        isFirstUserMessage,
      };
    });

    const thread = await prisma.thread.findUnique({
      where: { id: txResult.threadId },
      select: { id: true, title: true, lockedProvider: true },
    });

    if (!thread) {
      return NextResponse.json({ ok: false, error: "thread_not_found" }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, createdAt: true },
    });

    if (txResult.isFirstUserMessage) {
      try {
        const [optionA, optionB] = await Promise.all([
          generateFromProvider("A", messages, mode),
          generateFromProvider("B", messages, mode),
        ]);

        const uiOrderSeed = Math.floor(Math.random() * 1_000_000_000);
        const duel = await prisma.duel.create({
          data: {
            threadId: thread.id,
            userMessageId: txResult.userMessageId,
            optionA,
            optionB,
            uiOrderSeed,
          },
        });

        const leftKey = uiOrderSeed % 2 === 0 ? "A" : "B";
        const rightKey = leftKey === "A" ? "B" : "A";

        return NextResponse.json({
          ok: true,
          kind: "duel",
          thread: { id: thread.id, title: thread.title, lockedProvider: null },
          duel: {
            id: duel.id,
            left: { text: leftKey === "A" ? optionA : optionB, key: leftKey },
            right: { text: rightKey === "A" ? optionA : optionB, key: rightKey },
          },
          messages,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "provider_error";
        if (message === "provider_not_configured") {
          return NextResponse.json({ ok: false, error: "provider_not_configured" }, { status: 400 });
        }
        return NextResponse.json({ ok: false, error: "provider_error" }, { status: 502 });
      }
    }

    if (!thread.lockedProvider) {
      return NextResponse.json({ ok: false, error: "thread_not_locked" }, { status: 400 });
    }

    try {
      const response = await generateFromProvider(thread.lockedProvider, messages, mode);
      const assistantMessage = await prisma.message.create({
        data: {
          threadId: thread.id,
          userId: user.id,
          role: "assistant",
          content: response,
        },
        select: { id: true, role: true, content: true, createdAt: true },
      });

      const updatedMessages = [...messages, assistantMessage];
      return NextResponse.json({
        ok: true,
        kind: "single",
        thread: { id: thread.id, title: thread.title, lockedProvider: thread.lockedProvider },
        messages: updatedMessages,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "provider_error";
      if (message === "provider_not_configured") {
        return NextResponse.json({ ok: false, error: "provider_not_configured" }, { status: 400 });
      }
      return NextResponse.json({ ok: false, error: "provider_error" }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "quota_exceeded") {
        return NextResponse.json({ ok: false, error: "quota_exceeded" }, { status: 403 });
      }
      if (error.message === "verified_quota_exceeded") {
        return NextResponse.json({ ok: false, error: "verified_quota_exceeded" }, { status: 403 });
      }
      if (error.message === "verified_daily_limit") {
        return NextResponse.json({ ok: false, error: "verified_daily_limit" }, { status: 403 });
      }
      if (error.message === "thread_not_found") {
        return NextResponse.json({ ok: false, error: "thread_not_found" }, { status: 404 });
      }
      if (error.message === "thread_not_locked") {
        return NextResponse.json({ ok: false, error: "thread_not_locked" }, { status: 400 });
      }
    }
    return unauthorizedResponse();
  }
}
