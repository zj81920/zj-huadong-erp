import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const employmentStatus = searchParams.get("employmentStatus") || "";
    const pageSize = parseInt(searchParams.get("pageSize") || "200");

    const where: Record<string, unknown> = { isActive: true };

    if (search) {
      where.OR = [
        { realName: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
      ];
    }

    // 支持按在职状态筛选
    if (employmentStatus) {
      const statuses = employmentStatus.split(",");
      where.employmentStatus = { in: statuses };
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, username: true, realName: true, role: true, department: true },
      orderBy: { realName: "asc" },
      take: pageSize,
    });

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("获取用户列表失败:", error);
    return NextResponse.json({ error: "获取用户列表失败" }, { status: 500 });
  }
}
