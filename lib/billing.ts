import crypto from "crypto";

export type BillingMode = "disabled" | "test" | "live";

export const PLAN_PRICING = {
  A1: 9900,
  A2: 19900,
} as const;

export type PlanKey = keyof typeof PLAN_PRICING;

export function getBillingMode(): BillingMode {
  const mode = (process.env.BILLING_MODE ?? "disabled").toLowerCase();
  if (mode === "live" || mode === "test") return mode;
  return "disabled";
}

export function isBillingConfigured() {
  const mode = getBillingMode();
  const keyId = process.env.BILLING_KEY_ID ?? "";
  const keySecret = process.env.BILLING_KEY_SECRET ?? "";
  return mode !== "disabled" && Boolean(keyId && keySecret);
}

export function getBillingCredentials() {
  return {
    keyId: process.env.BILLING_KEY_ID ?? "",
    keySecret: process.env.BILLING_KEY_SECRET ?? "",
    currency: process.env.BILLING_CURRENCY ?? "INR",
  };
}

export function getSubscriptionPeriodDays() {
  const raw = Number(process.env.SUBSCRIPTION_PERIOD_DAYS ?? 30);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

export function getPlanAmount(plan: PlanKey) {
  return PLAN_PRICING[plan];
}

export function verifySignature(payload: string, signature: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature ?? "", "utf8");
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}
