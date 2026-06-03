import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { realName, phone, email, avatarUrl, signatureUrl } = body;

    if (realName === undefined && phone === undefined && email === undefined && avatarUrl === undefined && signatureUrl === undefined) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(realName !== undefined && { realName: realName.trim() }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
        ...(signatureUrl !== undefined && { signatureUrl: signatureUrl || null }),
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        username: updated.username,
        realName: updated.realName,
        phone: updated.phone,
        email: updated.email,
        department: updated.department,
        avatarUrl: updated.avatarUrl,
        signatureUrl: updated.signatureUrl,
      },
    });
  } catch (error) {
    console.error("更新个人资料失败:", error);
    return NextResponse.json({ error: "更新个人资料失败" }, { status: 500 });
  }
}
