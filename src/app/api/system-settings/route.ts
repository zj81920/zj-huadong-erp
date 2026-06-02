import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 403 });
    }
    const settings = await prisma.systemSetting.findMany();
    const result: Record<string, string> = {};
    settings.forEach((s) => {
      result[s.key] = s.value;
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("获取系统设置失败:", error);
    return NextResponse.json({ error: "获取系统设置失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "仅管理员可修改系统设置" }, { status: 403 });
    }

    const body = await request.json();
    const { settings } = body as { settings: Record<string, string> };

    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "参数格式错误" }, { status: 400 });
    }

    const upserts = Object.entries(settings).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    );

    await prisma.$transaction(upserts);

    return NextResponse.json({ message: "保存成功" });
  } catch (error) {
    console.error("保存系统设置失败:", error);
    return NextResponse.json({ error: "保存系统设置失败" }, { status: 500 });
  }
}
