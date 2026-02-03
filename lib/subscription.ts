import { prisma } from "@/lib/db";
import { PLAN_LIMITS, type Plan } from "@/lib/constants";

export type SubscriptionInfo = {
  plan: Plan;
  status: "active" | "inactive";
};

export async function getEffectivePlan(userId: string): Promise<SubscriptionInfo> {
  const now = new Date();
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "active",
      currentPeriodEnd: { gte: now },
    },
    orderBy: { currentPeriodEnd: "desc" },
  });

  if (subscription) {
    return { plan: subscription.plan, status: "active" };
  }

  return { plan: "A1", status: "inactive" };
}

export function getPlanLimits(plan: Plan) {
  return PLAN_LIMITS[plan];
}
