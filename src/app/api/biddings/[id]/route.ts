import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bidding = await prisma.bidding.findUnique({
      where: { id },
      include: {
        projectLead: {
          select: { id: true, projectSourceId: true, projectName: true, customer: { select: { name: true } } },
        },
      },
    });

    if (!bidding) {
      return NextResponse.json({ error: "投标记录不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: bidding });
  } catch (error) {
    console.error("获取投标详情失败:", error);
    return NextResponse.json({ error: "获取投标详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.bidding.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "投标记录不存在" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const fields = [
      "tenderFileReg", "tenderFileUrl", "bidFileUrl",
      "bondPaymentStatus", "bidResult",
      "failReason", "attachmentUrl", "description",
    ];
    fields.forEach((f) => {
      if (body[f] !== undefined) updateData[f] = body[f]?.trim?.() || null;
    });

    if (body.tenderFiles !== undefined) updateData.tenderFiles = body.tenderFiles;

    if (body.bidDeadline !== undefined)
      updateData.bidDeadline = body.bidDeadline ? new Date(body.bidDeadline) : null;
    if (body.bondAmount !== undefined)
      updateData.bondAmount = body.bondAmount ? parseFloat(body.bondAmount) : null;
    if (body.bidAmount !== undefined)
      updateData.bidAmount = body.bidAmount ? parseFloat(body.bidAmount) : null;
    if (body.score !== undefined)
      updateData.score = body.score ? parseFloat(body.score) : null;

    const bidding = await prisma.bidding.update({
      where: { id },
      data: updateData,
      include: {
        projectLead: {
          select: { id: true, projectSourceId: true, projectName: true, customer: { select: { name: true } } },
        },
      },
    });

    if (body.bidResult !== undefined) {
      const projectSourceId = existing.projectSourceId;
      let newLeadStatus: string | null = null;
      if (body.bidResult === "已中标") newLeadStatus = "已中标";
      else if (body.bidResult === "未中标") newLeadStatus = "放弃";
      if (newLeadStatus) {
        await prisma.projectLead.update({
          where: { projectSourceId },
          data: { currentStatus: newLeadStatus },
        });
      }
    }

    return NextResponse.json({ data: bidding });
  } catch (error) {
    console.error("更新投标记录失败:", error);
    return NextResponse.json({ error: "更新投标记录失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.bidding.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "投标记录不存在" }, { status: 404 });
    }

    await prisma.bidding.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除投标记录失败:", error);
    return NextResponse.json({ error: "删除投标记录失败" }, { status: 500 });
  }
}
