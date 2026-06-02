import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const bidResult = searchParams.get("bidResult") || "";
    const projectSourceId = searchParams.get("projectSourceId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { projectSourceId: { contains: search, mode: "insensitive" } },
        { projectLead: { projectName: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (bidResult) {
      where.bidResult = bidResult;
    }

    if (projectSourceId) {
      where.projectSourceId = projectSourceId;
    }

    const [biddings, total] = await Promise.all([
      prisma.bidding.findMany({
        where,
        include: {
          projectLead: {
            select: { id: true, projectSourceId: true, projectName: true, customerId: true, customer: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.bidding.count({ where }),
    ]);

    return NextResponse.json({
      data: biddings,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取投标列表失败:", error);
    return NextResponse.json({ error: "获取投标列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectSourceId,
      tenderFileReg,
      tenderFileUrl,
      bidFileUrl,
      bidDeadline,
      bondAmount,
      bondPaymentStatus,
      bidAmount,
      score,
      failReason,
      attachmentUrl,
      description,
      tenderFiles,
    } = body;

    if (!projectSourceId) {
      return NextResponse.json({ error: "请选择关联的项目线索" }, { status: 400 });
    }

    const lead = await prisma.projectLead.findUnique({
      where: { projectSourceId },
      include: { quotations: { select: { id: true } } },
    });

    if (!lead) {
      return NextResponse.json({ error: "项目线索不存在" }, { status: 400 });
    }

    if (lead.quotations.length > 0) {
      return NextResponse.json({ error: "该线索已有报价记录，无法添加投标" }, { status: 400 });
    }

    const bidding = await prisma.bidding.create({
      data: {
        projectSourceId,
        tenderFileReg: tenderFileReg?.trim() || null,
        tenderFileUrl: tenderFileUrl?.trim() || null,
        bidFileUrl: bidFileUrl?.trim() || null,
        bidDeadline: bidDeadline ? new Date(bidDeadline) : null,
        bondAmount: bondAmount ? parseFloat(bondAmount) : null,
        bondPaymentStatus: bondPaymentStatus || "未付",
        bidResult: null,
        bidAmount: bidAmount ? parseFloat(bidAmount) : null,
        score: score ? parseFloat(score) : null,
        failReason: failReason?.trim() || null,
        attachmentUrl: attachmentUrl?.trim() || null,
        description: description?.trim() || null,
        tenderFiles: tenderFiles || [],
      },
      include: {
        projectLead: {
          select: { id: true, projectSourceId: true, projectName: true, customer: { select: { name: true } } },
        },
      },
    });

    await prisma.projectLead.update({
      where: { projectSourceId },
      data: { currentStatus: "投标中", leadMode: "投标" },
    });

    return NextResponse.json({ data: bidding }, { status: 201 });
  } catch (error) {
    console.error("创建投标记录失败:", error);
    return NextResponse.json({ error: "创建投标记录失败" }, { status: 500 });
  }
}
