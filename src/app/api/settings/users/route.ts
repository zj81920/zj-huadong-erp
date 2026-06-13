import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth";
import { getSignedUrl, isOSSConfigured } from "@/lib/oss";

/** 从 signatureUrl 提取 OSS key */
function extractOssKey(url: string): string {
  if (url.startsWith("http")) {
    const pathname = new URL(url).pathname;
    return pathname.startsWith("/") ? pathname.slice(1) : pathname;
  }
  return url; // 已经是 key
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") || "20") || 20);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { realName: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          userRoles: {
            include: {
              role: {
                select: { id: true, code: true, name: true, department: { select: { name: true } } },
              },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const useOSS = isOSSConfigured();

    const data = users.map((u) => {
      // 为电子签名生成 OSS 签名 URL（7天有效）
      let signedSignatureUrl: string | null = null;
      if (u.signatureUrl) {
        try {
          const key = extractOssKey(u.signatureUrl);
          if (useOSS) {
            signedSignatureUrl = getSignedUrl(key, 7 * 24 * 3600);
          } else {
            // 本地模式：直接用 /uploads/ 路径
            signedSignatureUrl = `/uploads/${key}`;
          }
        } catch {
          signedSignatureUrl = u.signatureUrl;
        }
      }

      return {
        id: u.id,
        username: u.username,
        realName: u.realName,
        phone: u.phone,
        email: u.email,
        role: u.role,
        department: u.department,
        signatureUrl: signedSignatureUrl || u.signatureUrl,
        avatarUrl: u.avatarUrl,
        isActive: u.isActive,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        roles: u.userRoles.map((ur) => ({
          id: ur.role.id,
          code: ur.role.code,
          name: ur.role.name,
          departmentName: (ur.role as any).department?.name || null,
        })),
      };
    });

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取用户列表失败:", error);
    return NextResponse.json({ error: "获取用户列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json({ error: "仅管理员可执行此操作" }, { status: 403 });
    }
    const body = await request.json();
    const { username, realName, password, phone, email, department, roleIds, signatureUrl, avatarUrl } = body;

    if (!username || !realName) {
      return NextResponse.json({ error: "用户名和姓名不能为空" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (existing) {
      return NextResponse.json({ error: "该用户名已存在" }, { status: 409 });
    }

    // 自动从角色获取部门：前端传了 priority，否则取第一个角色所属部门
    let userDepartment = department?.trim() || null;
    if (!userDepartment && roleIds && roleIds.length > 0) {
      const firstRole = await prisma.role.findUnique({
        where: { id: roleIds[0] },
        include: { department: { select: { name: true } } },
      });
      userDepartment = firstRole?.department?.name || null;
    }

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        password: password || "123456",
        realName: realName.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        department: userDepartment,
        signatureUrl: signatureUrl || null,
        avatarUrl: avatarUrl || null,
        role: roleIds && roleIds.length > 0 ? "custom" : "staff",
        userRoles: {
          create: (roleIds || []).map((roleId: string) => ({ roleId })),
        },
      },
      include: {
        userRoles: {
          include: { role: { select: { id: true, code: true, name: true } } },
        },
      },
    });

    // 同步到 DS 系统（异步，不阻塞）
    if (user.email) {
      try {
        // 检查同步开关
        const setting = await prisma.systemSetting.findUnique({
          where: { key: "ds_sync_disabled" },
        });
        if (setting?.value !== "true") {
          const { dsCreateUser } = await import("@/lib/ds-client");

          // 提取 OSS key
          let signatureImage: string | null = null;
          if (user.signatureUrl) {
            if (user.signatureUrl.startsWith("http")) {
              signatureImage = new URL(user.signatureUrl).pathname.replace(/^\//, "");
            } else {
              signatureImage = user.signatureUrl;
            }
          }

          dsCreateUser({
            name: user.realName,
            email: user.email,
            password: "123456",
            signatureImage,
          }).catch((err: Error) => {
            console.error("[user-sync] DS 创建用户失败:", err.message);
          });
        }
      } catch (err) {
        console.error("[user-sync] DS 同步异常:", err);
      }
    }

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    console.error("创建用户失败:", error);
    return NextResponse.json({ error: "创建用户失败" }, { status: 500 });
  }
}
