import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const applicantId = searchParams.get("applicantId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (status) {
      where.approvalStatus = status;
    }

    if (applicantId) {
      where.applicantId = applicantId;
    }

    const [applications, total] = await Promise.all([
      prisma.paymentApplication.findMany({
        where,
        include: {
          payable: {
            include: {
              project: { select: { id: true, projectSourceId: true, name: true, projectCode: true } },
            },
          },
          applicant: { select: { id: true, realName: true, username: true } },
          paymentVouchers: {
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              bankAccount: true,
              paymentMethod: true,
              paymentReason: true,
              remark: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.paymentApplication.count({ where }),
    ]);

    return NextResponse.json({
      data: applications,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取付款申请列表失败:", error);
    return NextResponse.json({ error: "获取付款申请列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payableId, applicantId, amount, paymentReason, paymentMethod, bankAccount, remark } = body;

    if (!payableId) {
      return NextResponse.json({ error: "必须提供应付记录ID" }, { status: 400 });
    }

    if (!applicantId) {
      return NextResponse.json({ error: "必须提供申请人ID" }, { status: 400 });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "金额必须大于0" }, { status: 400 });
    }

    const payable = await prisma.payable.findUnique({ where: { id: payableId } });
    if (!payable) {
      return NextResponse.json({ error: "应付记录不存在" }, { status: 400 });
    }

    const application = await prisma.paymentApplication.create({
      data: {
        payableId,
        applicantId,
        amount: parseFloat(amount),
        approvalStatus: "草稿",
        paymentReason: paymentReason ?? null,
        paymentMethod: paymentMethod ?? null,
        bankAccount: bankAccount ?? null,
        remark: remark ?? null,
      },
      include: {
        payable: {
          include: {
            project: { select: { id: true, projectSourceId: true, name: true, projectCode: true } },
          },
        },
        applicant: { select: { id: true, realName: true, username: true } },
        paymentVouchers: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            bankAccount: true,
            paymentMethod: true,
            paymentReason: true,
            remark: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ data: application }, { status: 201 });
  } catch (error) {
    console.error("创建付款申请失败:", error);
    return NextResponse.json({ error: "创建付款申请失败" }, { status: 500 });
  }
}
