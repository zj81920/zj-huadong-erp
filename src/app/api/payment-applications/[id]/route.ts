import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin, getCurrentUser } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const application = await prisma.paymentApplication.findUnique({
      where: { id },
      include: {
        payable: {
          include: {
            project: { select: { id: true, projectSourceId: true, name: true, projectCode: true } },
          },
        },
        applicant: { select: { id: true, realName: true, username: true } },
        paymentVouchers: true,
      },
    });

    if (!application) {
      return NextResponse.json({ error: "付款申请不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: application });
  } catch (error) {
    console.error("获取付款申请详情失败:", error);
    return NextResponse.json({ error: "获取付款申请详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.paymentApplication.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "付款申请不存在" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.amount !== undefined) updateData.amount = parseFloat(body.amount);
    if (body.approvalStatus !== undefined) updateData.approvalStatus = body.approvalStatus;
    if (body.applicantId !== undefined) updateData.applicantId = body.applicantId;
    if (body.paymentReason !== undefined) updateData.paymentReason = body.paymentReason ?? null;
    if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod ?? null;
    if (body.bankAccount !== undefined) updateData.bankAccount = body.bankAccount ?? null;
    if (body.remark !== undefined) updateData.remark = body.remark ?? null;
    if (body.approvalInstanceId !== undefined) updateData.approvalInstanceId = body.approvalInstanceId ?? null;

    const application = await prisma.paymentApplication.update({
      where: { id },
      data: updateData,
      include: {
        payable: {
          include: {
            project: { select: { id: true, projectSourceId: true, name: true, projectCode: true } },
          },
        },
        applicant: { select: { id: true, realName: true, username: true } },
        paymentVouchers: true,
      },
    });

    return NextResponse.json({ data: application });
  } catch (error) {
    console.error("更新付款申请失败:", error);
    return NextResponse.json({ error: "更新付款申请失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminUser = await getCurrentUser();

    const existing = await prisma.paymentApplication.findUnique({
      where: { id },
      include: { paymentVouchers: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "付款申请不存在" }, { status: 404 });
    }

    if (existing.paymentVouchers.length > 0 && !isAdmin(adminUser)) {
      return NextResponse.json({ error: "该付款申请已有付款凭证，无法删除" }, { status: 400 });
    }

    await prisma.paymentApplication.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除付款申请失败:", error);
    return NextResponse.json({ error: "删除付款申请失败" }, { status: 500 });
  }
}
