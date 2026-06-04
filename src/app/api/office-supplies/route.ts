import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkReadPermission } from "@/lib/permission-check";

export async function GET(request: NextRequest) {
  try {
    const { canReadAll, userId } = await checkReadPermission("office_supplies")
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { spec: { contains: search, mode: "insensitive" } },
        { storeLocation: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) {
      where.category = category;
    }

    // 权限过滤
    if (!canReadAll && userId) {
      where.createdById = userId;
    }

    const [data, total] = await Promise.all([
      prisma.officeSupply.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.officeSupply.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("获取办公用品列表失败:", error);
    return NextResponse.json({ error: "获取办公用品列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentUser = await getCurrentUser();
    const { name, category, spec, unit, quantity, unitPrice, totalPrice, storeLocation, remark } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }

    const supply = await prisma.officeSupply.create({
      data: {
        name: name.trim(),
        category: category || null,
        spec: spec?.trim() || null,
        unit: unit?.trim() || null,
        quantity: quantity ?? 0,
        unitPrice: unitPrice ?? null,
        totalPrice: totalPrice ?? null,
        storeLocation: storeLocation?.trim() || null,
        remark: remark?.trim() || null,
        createdById: currentUser?.id || null,
      },
    });

    return NextResponse.json({ data: supply }, { status: 201 });
  } catch (error) {
    console.error("创建办公用品失败:", error);
    return NextResponse.json({ error: "创建办公用品失败" }, { status: 500 });
  }
}
