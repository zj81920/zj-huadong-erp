import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const projectSourceId = searchParams.get("projectSourceId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { requestNo: { contains: search, mode: "insensitive" } },
        { projectSourceId: { contains: search, mode: "insensitive" } },
        { items: { some: { materialName: { contains: search, mode: "insensitive" } } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (projectSourceId) {
      where.projectSourceId = projectSourceId;
    }

    const [records, total] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        include: {
          project: { select: { projectSourceId: true, name: true, status: true } },
          items: { orderBy: { sortOrder: "asc" } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.purchaseRequest.count({ where }),
    ]);

    return NextResponse.json({
      data: records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取采购需求列表失败:", error);
    return NextResponse.json({ error: "获取采购需求列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectSourceId, requestType, requiredDate, items, attachments } = body;

    if (!projectSourceId || !projectSourceId.trim()) {
      return NextResponse.json({ error: "项目不能为空" }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "至少需要一个明细行" }, { status: 400 });
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].materialName || !items[i].materialName.trim()) {
        return NextResponse.json({ error: `第${i + 1}行物资名称不能为空` }, { status: 400 });
      }
    }

    const project = await prisma.project.findUnique({
      where: { projectSourceId: projectSourceId.trim() },
    });

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const prefix = `CG-${dateStr}-`;

    const lastRequest = await prisma.purchaseRequest.findFirst({
      where: { requestNo: { startsWith: prefix } },
      orderBy: { requestNo: "desc" },
      select: { requestNo: true },
    });

    let seq = 1;
    if (lastRequest) {
      const lastSeq = parseInt(lastRequest.requestNo.slice(prefix.length), 10);
      seq = lastSeq + 1;
    }

    const requestNo = `${prefix}${String(seq).padStart(3, "0")}`;

    const record = await prisma.purchaseRequest.create({
      data: {
        requestNo,
        projectSourceId: projectSourceId.trim(),
        requestType: requestType || "项目需求",
        requiredDate: requiredDate ? new Date(requiredDate) : null,
        status: "草稿",
        items: {
          create: items.map((item: Record<string, unknown>, index: number) => ({
            materialName: (item.materialName as string).trim(),
            spec: (item.spec as string)?.trim() || null,
            material: (item.material as string)?.trim() || null,
            brand: (item.brand as string)?.trim() || null,
            standardNo: (item.standardNo as string)?.trim() || null,
            unit: (item.unit as string)?.trim() || null,
            quantity: item.quantity ? parseFloat(String(item.quantity)) : null,
            remark: (item.remark as string)?.trim() || null,
            sortOrder: index,
          })),
        },
      },
      include: {
        project: { select: { projectSourceId: true, name: true, status: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("创建采购需求失败:", error);
    return NextResponse.json({ error: "创建采购需求失败" }, { status: 500 });
  }
}
