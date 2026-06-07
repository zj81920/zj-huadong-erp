import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bankAccount = await prisma.bankAccount.findUnique({ where: { id } });

    if (!bankAccount) {
      return NextResponse.json(
        { error: "银行账户不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: bankAccount });
  } catch (error) {
    console.error("获取银行账户详情失败:", error);
    return NextResponse.json(
      { error: "获取银行账户详情失败" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { accountName, bankName, accountNo, accountType, isActive, remark } =
      body;

    const existing = await prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "银行账户不存在" },
        { status: 404 }
      );
    }

    if (accountNo !== undefined && accountNo.trim() !== existing.accountNo) {
      const duplicate = await prisma.bankAccount.findUnique({
        where: { accountNo: accountNo.trim() },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "银行账号已存在" },
          { status: 400 }
        );
      }
    }

    if (
      accountType !== undefined &&
      !["公司账户", "个人账户"].includes(accountType)
    ) {
      return NextResponse.json(
        { error: "账户类型只能为'公司账户'或'个人账户'" },
        { status: 400 }
      );
    }

    const bankAccount = await prisma.bankAccount.update({
      where: { id },
      data: {
        ...(accountName !== undefined && { accountName: accountName.trim() }),
        ...(bankName !== undefined && { bankName: bankName.trim() }),
        ...(accountNo !== undefined && { accountNo: accountNo.trim() }),
        ...(accountType !== undefined && { accountType }),
        ...(isActive !== undefined && { isActive }),
        ...(remark !== undefined && { remark: remark?.trim() || null }),
      },
    });

    return NextResponse.json({ data: bankAccount });
  } catch (error) {
    console.error("更新银行账户失败:", error);
    return NextResponse.json(
      { error: "更新银行账户失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "银行账户不存在" },
        { status: 404 }
      );
    }

    await cleanupBusinessApprovalRecords("bank_account", id);
    await prisma.bankAccount.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除银行账户失败:", error);
    return NextResponse.json(
      { error: "删除银行账户失败" },
      { status: 500 }
    );
  }
}
