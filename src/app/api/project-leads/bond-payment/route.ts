import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { startApprovalFlow, canInitiateFlow } from "@/lib/approval-engine";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 403 });
    }

    const { leadId, projectSourceId, borrowerName, amount, description, bankName, bankAccount } =
      await request.json();

    if (!leadId || !projectSourceId) {
      return NextResponse.json(
        { error: "缺少线索信息" },
        { status: 400 }
      );
    }

    const canInitiate = await canInitiateFlow({ businessType: "lending_out", flowLevel: "common", userId: user.id });
    if (!canInitiate) {
      return NextResponse.json({ error: "您没有权限发起借出款审批流程" }, { status: 403 });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: "保证金金额必须大于0" },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);

    const lending = await prisma.lendingOut.create({
      data: {
        lendingType: "投标保证金",
        projectSourceId,
        borrowerName: borrowerName || "",
        borrowerBankName: bankName?.trim() || null,
        borrowerBankAccount: bankAccount?.trim() || null,
        amount: parsedAmount,
        returnedAmount: 0,
        remainingAmount: parsedAmount,
        lendingDate: new Date(),
        description: description || null,
        status: "审批中",
      },
    });

    if (borrowerName && (bankName || bankAccount)) {
      const existingCounterparty = await prisma.counterpartyInfo.findFirst({
        where: {
          name: borrowerName.trim(),
          bankName: bankName?.trim() || null,
          bankAccount: bankAccount?.trim() || null,
        },
      });
      if (!existingCounterparty) {
        await prisma.counterpartyInfo.create({
          data: {
            name: borrowerName.trim(),
            bankName: bankName?.trim() || null,
            bankAccount: bankAccount?.trim() || null,
          },
        });
      }
    }

    try {
      await startApprovalFlow({
        businessType: "lending_out",
        businessId: lending.id,
        flowLevel: "common",
        initiatorId: user.id,
        projectSourceId,
      });
    } catch (approvalErr) {
      console.error("启动审批流失败（回退为草稿）:", approvalErr);
      await prisma.lendingOut.update({
        where: { id: lending.id },
        data: { status: "草稿" },
      });

      await prisma.projectLead.update({
        where: { id: leadId },
        data: {
          bondPaymentStatus: "未付",
          bondLendingId: lending.id,
        },
      });

      return NextResponse.json({
        data: lending,
        warning: "审批流未配置，已创建为草稿，请在财务支出页面手动提交",
      });
    }

    await prisma.projectLead.update({
      where: { id: leadId },
      data: {
        bondPaymentStatus: "审批中",
        bondLendingId: lending.id,
      },
    });

    return NextResponse.json({ data: lending }, { status: 201 });
  } catch (error) {
    console.error("发起保证金支付失败:", error);
    return NextResponse.json(
      { error: "发起保证金支付失败" },
      { status: 500 }
    );
  }
}
