import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin, getCurrentUser } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const record = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        project: { select: { projectSourceId: true, name: true, status: true } },
        items: { orderBy: { sortOrder: "asc" } },
        inquiry: true,
      },
    });

    if (!record) {
      return NextResponse.json({ error: "采购需求不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("获取采购需求详情失败:", error);
    return NextResponse.json({ error: "获取采购需求详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "采购需求不存在" }, { status: 404 });
    }

    if (body.convertToInquiry) {
      if (existing.status !== "已批准") {
        return NextResponse.json({ error: "只有已批准状态的需求才能转询价" }, { status: 400 });
      }

      return NextResponse.json({
        data: {
          ...existing,
          message: "可转询价",
        },
      });
    }

    if (body.status && body.status !== existing.status) {
      const record = await prisma.purchaseRequest.update({
        where: { id },
        data: { status: body.status },
        include: {
          project: { select: { projectSourceId: true, name: true, status: true } },
          items: { orderBy: { sortOrder: "asc" } },
          inquiry: true,
        },
      });

      return NextResponse.json({ data: record });
    }

    if (existing.status !== "草稿") {
      return NextResponse.json({ error: "只有草稿状态的需求才能编辑" }, { status: 400 });
    }

    const { projectSourceId, requestType, requiredDate, items, attachments } = body;

    if (projectSourceId !== undefined && projectSourceId.trim()) {
      const project = await prisma.project.findUnique({
        where: { projectSourceId: projectSourceId.trim() },
      });
      if (!project) {
        return NextResponse.json({ error: "项目不存在" }, { status: 404 });
      }
    }

    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: "至少需要一个明细行" }, { status: 400 });
      }

      for (let i = 0; i < items.length; i++) {
        if (!items[i].materialName || !items[i].materialName.trim()) {
          return NextResponse.json({ error: `第${i + 1}行物资名称不能为空` }, { status: 400 });
        }
      }
    }

    await prisma.purchaseRequestItem.deleteMany({
      where: { purchaseRequestId: id },
    });

    const updateData: Record<string, unknown> = {};
    if (projectSourceId !== undefined) updateData.projectSourceId = projectSourceId.trim();
    if (requestType !== undefined) updateData.requestType = requestType;
    if (requiredDate !== undefined) updateData.requiredDate = requiredDate ? new Date(requiredDate) : null;
    if (attachments !== undefined) updateData.attachments = attachments;

    if (items && Array.isArray(items)) {
      updateData.items = {
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
      };
    }

    const record = await prisma.purchaseRequest.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { projectSourceId: true, name: true, status: true } },
        items: { orderBy: { sortOrder: "asc" } },
        inquiry: true,
      },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("更新采购需求失败:", error);
    return NextResponse.json({ error: "更新采购需求失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminUser = await getCurrentUser();

    const existing = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: { inquiry: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "采购需求不存在" }, { status: 404 });
    }

    if (existing.status !== "草稿" && !isAdmin(adminUser)) {
      return NextResponse.json({ error: "只有草稿状态的需求才能删除" }, { status: 400 });
    }

    if (existing.inquiry && !isAdmin(adminUser)) {
      return NextResponse.json({ error: "该需求已关联询价，无法删除" }, { status: 400 });
    }

    await prisma.purchaseRequest.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除采购需求失败:", error);
    return NextResponse.json({ error: "删除采购需求失败" }, { status: 500 });
  }
}
