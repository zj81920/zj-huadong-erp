import { cookies } from "next/headers";
import prisma from "./prisma";

const SESSION_COOKIE = "erp_session";

export interface CurrentUser {
  id: string;
  username: string;
  realName: string;
  phone: string | null;
  email: string | null;
  department: string | null;
  roles: { id: string; code: string; name: string; modulePermissions: string }[];
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const payload = JSON.parse(Buffer.from(session, "base64").toString());
    const userId = payload.userId as string;
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
      include: {
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                modulePermissions: true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      realName: user.realName,
      phone: user.phone,
      email: user.email,
      department: user.department,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        code: ur.role.code,
        name: ur.role.name,
        modulePermissions: ur.role.modulePermissions,
      })),
    };
  } catch {
    return null;
  }
}

export function createSessionToken(userId: string): string {
  const payload = JSON.stringify({
    userId,
    ts: Date.now(),
  });
  return Buffer.from(payload).toString("base64");
}

export function parseSessionToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    return payload.userId || null;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
