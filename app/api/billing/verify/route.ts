import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, unauthorizedResponse } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/rateLimit";
import {
  getBillingCredentials,
  getSubscriptionPeriodDays,
  isBillingConfigured,
  verifySignature,
} from "@/lib/billing";

type VerifyRequest = {
  plan?: "A1" | "A2";
  orderId?: string;
  paymentId?: string;
  signature?: string;
};

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const rateKey = getRateLimitKey(req, user.id);
    if (!checkRateLimit(rateKey)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    if (!isBillingConfigured()) {
      return NextResponse.json({ ok: false, error: "billing_not_configured" }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as VerifyRequest | null;
    const plan = body?.plan === "A2" ? "A2" : body?.plan === "A1" ? "A1" : null;
    const orderId = body?.orderId ?? "";
    const paymentId = body?.paymentId ?? "";
    const signature = body?.signature ?? "";

    if (!plan || !orderId || !paymentId || !signature) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const { keySecret } = getBillingCredentials();
    const payload = `${orderId}|${paymentId}`;

    if (!verifySignature(payload, signature, keySecret)) {
      await prisma.payment.updateMany({
        where: { orderId },
        data: { status: "failed" },
      });
      return NextResponse.json({ ok: false, error: "payment_verification_failed" }, { status: 400 });
    }

    const periodDays = getSubscriptionPeriodDays();

    const subscription = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { orderId } });

      if (!payment) {
        throw new Error("payment_not_found");
      }

      if (payment.status === "verified") {
        const existing = await tx.subscription.findFirst({
          where: { userId: user.id, status: "active" },
          orderBy: { currentPeriodEnd: "desc" },
        });
        return existing;
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "verified", paymentId },
      });

      const now = new Date();
      const current = await tx.subscription.findFirst({
        where: { userId: user.id, status: "active", currentPeriodEnd: { gte: now } },
        orderBy: { currentPeriodEnd: "desc" },
      });

      const startBase = current ? (current.currentPeriodEnd > now ? current.currentPeriodEnd : now) : now;
      const newEnd = new Date(startBase.getTime() + periodDays * 24 * 60 * 60 * 1000);

      if (current) {
        return tx.subscription.update({
          where: { id: current.id },
          data: {
            plan,
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: newEnd,
          },
        });
      }

      return tx.subscription.create({
        data: {
          userId: user.id,
          plan,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: newEnd,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      subscription: {
        plan: subscription?.plan ?? plan,
        status: subscription?.status ?? "active",
        currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "payment_not_found") {
      return NextResponse.json({ ok: false, error: "payment_not_found" }, { status: 404 });
    }
    return unauthorizedResponse();
  }
}
