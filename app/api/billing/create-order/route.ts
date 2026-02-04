import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, unauthorizedResponse } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/rateLimit";
import {
  getBillingCredentials,
  getBillingMode,
  getPlanAmount,
  isBillingConfigured,
  type PlanKey,
} from "@/lib/billing";

type OrderRequest = {
  plan?: "A1" | "A2";
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

    const body = (await req.json().catch(() => null)) as OrderRequest | null;
    const plan = body?.plan === "A2" ? "A2" : body?.plan === "A1" ? "A1" : null;

    if (!plan) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const { keyId, keySecret, currency } = getBillingCredentials();
    const amount = getPlanAmount(plan as PlanKey);
    const mode = getBillingMode();

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount,
        currency,
        payment_capture: 1,
        notes: {
          userId: user.id,
          plan,
          mode,
        },
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "billing_error" }, { status: 502 });
    }

    const order = (await res.json()) as { id: string; amount: number; currency: string };

    await prisma.payment.create({
      data: {
        userId: user.id,
        plan,
        amount,
        currency,
        orderId: order.id,
        status: "created",
      },
    });

    return NextResponse.json({
      ok: true,
      plan,
      order: { id: order.id, amount: order.amount, currency: order.currency },
      publicKey: keyId,
    });
  } catch {
    return unauthorizedResponse();
  }
}
