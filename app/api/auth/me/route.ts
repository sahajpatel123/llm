import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      plan: subscription?.plan ?? null,
      status: subscription?.status ?? "inactive",
    },
  });
}
