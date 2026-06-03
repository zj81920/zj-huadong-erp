import { NextRequest, NextResponse } from "next/server";
import { parseSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const PUBLIC_PATHS = ["/login", "/api/auth", "/inquiry/quote", "/api/inquiry-quote"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isPublic) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (!sessionCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const userId = parseSessionToken(sessionCookie);
  if (!userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "会话无效" }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  }

  // 系统设置页面仅 admin 可访问
  if (pathname.startsWith("/settings")) {
    const prisma = new PrismaClient();
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.username !== "admin") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "无权限访问" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/", request.url));
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", userId);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|assets).*)",
  ],
};
