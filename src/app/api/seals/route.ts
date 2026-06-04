import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkReadPermission } from "@/lib/permission-check";

export async function GET(request: NextRequest) {
  try {
    const { canReadAll, userId } = await checkReadPermission("seals")
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const sealType = searchParams.get("sealType") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { custodian: { contains: search, mode: "insensitive" } },
      ];
    }
    if (sealType) where.sealType = sealType;
    if (status) where.status = status;

    // 权限过滤
    if (!canReadAll && userId) {
      where.createdById = userId;
    }

    const [records, total] = await Promise.all([
      prisma.seal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.seal.count({ where }),
    ]);

    return NextResponse.json({
      data: records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取印章列表失败:", error);
    return NextResponse.json({ error: "获取印章列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentUser = await getCurrentUser();
    const { name, sealType, custodian, location, status, remark } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "印章名称不能为空" }, { status: 400 });
    }
    if (!sealType) {
      return NextResponse.json({ error: "印章类型不能为空" }, { status: 400 });
    }

    const record = await prisma.seal.create({
      data: {
        name: name.trim(),
        sealType,
        custodian: custodian?.trim() || null,
        location: location?.trim() || null,
        status: status || "在库",
        remark: remark?.trim() || null,
        createdById: currentUser?.id || null,
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("创建印章失败:", error);
    return NextResponse.json({ error: "创建印章失败" }, { status: 500 });
  }
}
