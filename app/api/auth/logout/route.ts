import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clearSessionCookie, hashToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = cookies();
  const token = cookieStore.get("sid")?.value;

  if (token) {
    const tokenHash = hashToken(token);
    await prisma.session.deleteMany({ where: { tokenHash } });
  }

  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
