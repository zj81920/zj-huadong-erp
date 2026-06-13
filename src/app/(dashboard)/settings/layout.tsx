import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { parseSessionToken, SESSION_COOKIE } from "@/lib/auth";

// 个人设置页面所有登录用户均可访问，其余 /settings 路由仅 admin 可访问
const PUBLIC_SETTINGS_PATHS = ["/settings/profile"];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 获取当前请求路径
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  const userId = sessionCookie ? parseSessionToken(sessionCookie) : null;

  if (!userId) {
    redirect("/login");
  }

  // 检查是否为公共的 settings 路径（如个人设置）
  const isPublicSettings = PUBLIC_SETTINGS_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));

  if (!isPublicSettings) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    if (!user || user.username !== "admin") {
      redirect("/");
    }
  }

  return <>{children}</>;
}
