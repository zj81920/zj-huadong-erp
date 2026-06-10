import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectSourceId: string; id: string }> }
) {
  try {
    const { projectSourceId, id } = await params;
    const body = await request.json();
    const { plannedPct, actualPct, status, delayDays } = body;

    const existing = await prisma.projectWbsNode.findFirst({
      where: { id, projectSourceId },
    });
    if (!existing) return NextResponse.json({ error: "节点不存在" }, { status: 404 });
    if (existing.level !== 4) {
      return NextResponse.json({ error: "仅4级节点(任务)支持进度填报" }, { status: 400 });
    }

    const finalPlanned = plannedPct ?? existing.plannedPct;
    const finalActual = actualPct ?? existing.actualPct;
    const alertStatus = finalActual < finalPlanned ? "滞后" : "正常";

    const node = await prisma.projectWbsNode.update({
      where: { id },
      data: {
        plannedPct: finalPlanned,
        actualPct: finalActual,
        alertStatus,
        delayDays: delayDays ?? 0,
        status: status ?? existing.status,
      },
    });

    return NextResponse.json({ data: node });
  } catch (error) {
    console.error("填报进度失败:", error);
    return NextResponse.json({ error: "填报进度失败" }, { status: 500 });
  }
}
