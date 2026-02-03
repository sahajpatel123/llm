import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionToken, hashToken, setSessionCookie } from "@/lib/auth";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";

  if (!isValidEmail(email) || password.length < 8) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ ok: false, error: "email_in_use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
  });

  const token = createSessionToken();
  const tokenHash = hashToken(token);
  const days = Number(process.env.SESSION_DAYS ?? 30);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
  setSessionCookie(res, token, expiresAt);
  return res;
}
