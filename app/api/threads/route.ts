import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, unauthorizedResponse } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const threads = await prisma.thread.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, threads });
  } catch {
    return unauthorizedResponse();
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => null)) as { title?: string } | null;
    const title = body?.title?.trim() || "New chat";

    const thread = await prisma.thread.create({
      data: {
        userId: user.id,
        title,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, thread });
  } catch {
    return unauthorizedResponse();
  }
}
