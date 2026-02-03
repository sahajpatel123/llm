import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "./db";

const SESSION_COOKIE = "sid";

function getSessionSecret() {
  return process.env.SESSION_SECRET ?? "";
}

export function hashToken(token: string): string {
  const secret = getSessionSecret();
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function getSessionUser(_req: Request) {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) return null;

  return session.user;
}

export async function requireUser(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    throw new Error("unauthorized");
  }
  return user;
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date) {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function unauthorizedResponse() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}
