import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { realName, password, phone, email, department, roleIds, signatureUrl, avatarUrl, isActive, aiFileSearch } = body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (realName !== undefined) updateData.realName = realName.trim();
    if (password !== undefined && password.trim()) updateData.password = password.trim();
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (department !== undefined) updateData.department = department?.trim() || null;
    if (signatureUrl !== undefined) updateData.signatureUrl = signatureUrl || null;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if ("aiFileSearch" in body) updateData.aiFileSearch = Boolean(aiFileSearch);

    if (roleIds !== undefined) {
      await prisma.userRole.deleteMany({ where: { userId: id } });
      if (roleIds.length > 0) {
        updateData.userRoles = {
          create: roleIds.map((roleId: string) => ({ roleId })),
        };
      }
      updateData.role = roleIds.length > 0 ? "custom" : "staff";

      // 自动从角色获取部门映射
      const firstRole = roleIds.length > 0
        ? await prisma.role.findUnique({
            where: { id: roleIds[0] },
            include: { department: { select: { name: true } } },
          })
        : null;
      updateData.department = firstRole?.department?.name || null;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        userRoles: {
          include: {
            role: {
              include: { department: { select: { name: true } } },
            },
          },
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
          const { dsUpdateUser } = await import("@/lib/ds-client");

          // 提取 OSS key
          let signatureImage: string | null = null;
          if (user.signatureUrl) {
            if (user.signatureUrl.startsWith("http")) {
              signatureImage = new URL(user.signatureUrl).pathname.replace(/^\//, "");
            } else {
              signatureImage = user.signatureUrl;
            }
          }

          dsUpdateUser(user.email, {
            name: user.realName,
            email: user.email,
            signatureImage,
          }).catch((err: Error) => {
            console.error("[user-sync] DS 更新用户失败:", err.message);
          });
        }
      } catch (err) {
        console.error("[user-sync] DS 同步异常:", err);
      }
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("更新用户失败:", error);
    return NextResponse.json({ error: "更新用户失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    if (existing.username === "admin") {
      return NextResponse.json({ error: "系统管理员账号不可删除" }, { status: 403 });
    }

    // 先同步删除 DS 用户
    if (existing.email) {
      const { dsDeleteUser } = await import("@/lib/ds-client");
      try {
        await dsDeleteUser(existing.email);
      } catch (err) {
        console.error("[user-sync] DS 删除用户失败:", err);
        return NextResponse.json(
          { error: "DS 系统删除用户失败，已取消操作" },
          { status: 500 }
        );
      }
    }

    await prisma.userRole.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ data: { id } });
  } catch (error) {
    console.error("删除用户失败:", error);
    return NextResponse.json({ error: "删除用户失败" }, { status: 500 });
  }
}
