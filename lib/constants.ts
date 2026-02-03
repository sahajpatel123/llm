export type Plan = "A1" | "A2";
export type Provider = "A" | "B";
export type Mode = "exploration" | "verified";
export type Role = "user" | "assistant" | "system";
export type SubscriptionStatus = "active" | "inactive";

export const PLAN_LIMITS: Record<Plan, { monthlyMessages: number; monthlyVerified: number; dailyVerifiedMax: number }> = {
  A1: { monthlyMessages: 400, monthlyVerified: 15, dailyVerifiedMax: 2 },
  A2: { monthlyMessages: 900, monthlyVerified: 45, dailyVerifiedMax: 2 },
};
