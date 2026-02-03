import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectivePlan, getPlanLimits } from "@/lib/subscription";
import { requireUser, unauthorizedResponse } from "@/lib/auth";

function getPeriodKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function getDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const now = new Date();
    const periodKey = getPeriodKey(now);
    const dayKey = getDayKey(now);

    const { plan, status } = await getEffectivePlan(user.id);
    const limits = getPlanLimits(plan);

    const ledger = await prisma.usageLedger.findUnique({
      where: { userId_periodKey: { userId: user.id, periodKey } },
    });

    const messagesUsed = ledger?.messagesUsed ?? 0;
    const verifiedUsed = ledger?.verifiedUsed ?? 0;
    const verifiedUsedToday = ledger?.verifiedDayKey === dayKey ? ledger.verifiedUsedToday : 0;

    return NextResponse.json({
      ok: true,
      plan,
      subscriptionStatus: status,
      periodKey,
      remainingMessages: Math.max(0, limits.monthlyMessages - messagesUsed),
      remainingVerified: Math.max(0, limits.monthlyVerified - verifiedUsed),
      remainingVerifiedToday: Math.max(0, limits.dailyVerifiedMax - verifiedUsedToday),
    });
  } catch {
    return unauthorizedResponse();
  }
}
