import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { parseSessionToken, SESSION_COOKIE } from "@/lib/auth";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  const userId = sessionCookie ? parseSessionToken(sessionCookie) : null;

  if (!userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });

  if (!user || user.username !== "admin") {
    redirect("/");
  }

  return <>{children}</>;
}
