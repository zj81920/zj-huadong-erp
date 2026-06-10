import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectSourceId: string }> }
) {
  try {
    const { projectSourceId } = await params;
    const nodes = await prisma.projectWbsNode.findMany({
      where: { projectSourceId },
      include: {
        responsiblePerson: { select: { id: true, realName: true } },
      },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json({ data: nodes });
  } catch (error) {
    console.error("获取WBS节点失败:", error);
    return NextResponse.json({ error: "获取WBS节点失败" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectSourceId: string }> }
) {
  try {
    const { projectSourceId } = await params;
    const body = await request.json();
    const { parentId, level, name, disciplineCode,
            plannedPct, actualPct, responsibleId,
            status, startDate, endDate, sortOrder, isMilestone } = body;

    if (!name || typeof level !== "number") {
      return NextResponse.json({ error: "缺少必填字段: name, level" }, { status: 400 });
    }

    // 自动计算 sortOrder
    let finalSortOrder = sortOrder ?? 0;
    if (finalSortOrder === 0 && parentId) {
      const siblingCount = await prisma.projectWbsNode.count({
        where: { projectSourceId, parentId },
      });
      finalSortOrder = siblingCount;
    }

    const node = await prisma.projectWbsNode.create({
      data: {
        projectSourceId,
        parentId: parentId || null,
        level,
        name,
        disciplineCode: disciplineCode || null,
        plannedPct: plannedPct ?? 0,
        actualPct: actualPct ?? 0,
        responsibleId: responsibleId || null,
        status: status || "未开始",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        sortOrder: finalSortOrder,
        isMilestone: isMilestone ?? false,
      },
      include: {
        responsiblePerson: { select: { id: true, realName: true } },
      },
    });

    return NextResponse.json({ data: node }, { status: 201 });
  } catch (error) {
    console.error("创建WBS节点失败:", error);
    return NextResponse.json({ error: "创建WBS节点失败" }, { status: 500 });
  }
}
