import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lead = await prisma.projectLead.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, industryType: true, contactPerson: true, phone: true } },
        biddings: true,
        quotations: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "项目线索不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: lead });
  } catch (error) {
    console.error("获取项目线索详情失败:", error);
    return NextResponse.json({ error: "获取项目线索详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.projectLead.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "项目线索不存在" }, { status: 404 });
    }

    const {
      customerId,
      projectName,
      location,
      estimatedInvestment,
      bidReleaseTime,
      infoSource,
      currentStatus,
      followUpRecords,
      competitorInfo,
    } = body;

    if (projectName !== undefined && !projectName.trim()) {
      return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (projectName !== undefined) updateData.projectName = projectName.trim();
    if (location !== undefined) updateData.location = location?.trim() || null;
    if (estimatedInvestment !== undefined)
      updateData.estimatedInvestment = estimatedInvestment ? parseFloat(estimatedInvestment) : null;
    if (bidReleaseTime !== undefined)
      updateData.bidReleaseTime = bidReleaseTime ? new Date(bidReleaseTime) : null;
    if (infoSource !== undefined) updateData.infoSource = infoSource?.trim() || null;
    if (currentStatus !== undefined) updateData.currentStatus = currentStatus;
    if (followUpRecords !== undefined) updateData.followUpRecords = followUpRecords;
    if (competitorInfo !== undefined) updateData.competitorInfo = competitorInfo;
    if (customerId !== undefined) updateData.customerId = customerId;

    const lead = await prisma.projectLead.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true, industryType: true } },
      },
    });

    return NextResponse.json({ data: lead });
  } catch (error) {
    console.error("更新项目线索失败:", error);
    return NextResponse.json({ error: "更新项目线索失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.projectLead.findUnique({
      where: { id },
      include: { _count: { select: { biddings: true, quotations: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "项目线索不存在" }, { status: 404 });
    }

    if (existing.currentStatus === "中标") {
      return NextResponse.json({ error: "已中标的线索不能删除" }, { status: 400 });
    }

    if (existing._count.biddings > 0) {
      return NextResponse.json(
        { error: `该线索下有 ${existing._count.biddings} 条投标记录，无法删除` },
        { status: 400 }
      );
    }

    await prisma.projectLead.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除项目线索失败:", error);
    return NextResponse.json({ error: "删除项目线索失败" }, { status: 500 });
  }
}
