import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "ningbox_admin_session";

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const valid = await isValidSession(token);

  const isLoginPage = req.nextUrl.pathname === "/login";

  if (!valid && !isLoginPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (valid && isLoginPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Всё, кроме статики и самого API логина/логаута (тем нужно ходить без сессии)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/login|api/logout).*)"],
};
