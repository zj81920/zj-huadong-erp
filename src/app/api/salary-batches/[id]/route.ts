import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkDeletePermission, checkEditPermission } from "@/lib/permission-check";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

const batchSelect = {
  id: true,
  batchNo: true,
  period: true,
  title: true,
  employeeCount: true,
  totalGrossSalary: true,
  totalSocialInsurancePersonal: true,
  totalSocialInsuranceCompany: true,
  totalHousingFundPersonal: true,
  totalHousingFundCompany: true,
  totalIncomeTax: true,
  totalOtherDeduction: true,
  totalNetSalary: true,
  totalBankOutflow: true,
  status: true,
  approvalInstanceId: true,
  bankAccountId: true,
  paymentMethod: true,
  paidAt: true,
  remark: true,
  createdAt: true,
  updatedAt: true,
  lastModifiedBy: true,
  items: {
    include: {
      employee: { select: { id: true, realName: true, username: true } },
    },
    orderBy: { employee: { realName: "asc" as const } },
  },
  bankAccount: {
    select: { id: true, accountName: true, bankName: true, accountNo: true },
  },
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const batch = await prisma.salaryBatch.findUnique({
      where: { id },
      select: batchSelect,
    });
    if (!batch) return NextResponse.json({ error: "批次不存在" }, { status: 404 });
    return NextResponse.json({ data: batch });
  } catch (error) {
    console.error("获取批次详情失败:", error);
    return NextResponse.json({ error: "获取批次详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    const body = await request.json();
    const { title, remark, items: updatedItems, status, bankAccountId, paymentMethod, paidAt } = body;

    const existing = await prisma.salaryBatch.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "批次不存在" }, { status: 404 });

    const editCheck = await checkEditPermission("salary_payment", undefined, existing.status, existing.createdById);
    if (!editCheck.allowed) {
      return NextResponse.json({ error: editCheck.error }, { status: 403 });
    }

    if (updatedItems && Array.isArray(updatedItems)) {
      for (const item of updatedItems) {
        const baseSalary = Number(item.baseSalary || 0);
        const bonus = Number(item.bonus || 0);
        const allowance = Number(item.allowance || 0);
        const grossSalary = baseSalary + bonus + allowance;
        const siPersonal = Number(item.socialInsurancePersonal || 0);
        const hfPersonal = Number(item.housingFundPersonal || 0);
        const incomeTax = Number(item.incomeTax || 0);
        const otherDeduction = Number(item.otherDeduction || 0);
        const totalDeduction = siPersonal + hfPersonal + incomeTax + otherDeduction;
        const netSalary = Math.round((grossSalary - totalDeduction) * 100) / 100;

        await prisma.salaryBatchItem.update({
          where: { id: item.id },
          data: {
            baseSalary,
            bonus,
            allowance,
            grossSalary,
            socialInsurancePersonal: siPersonal,
            housingFundPersonal: hfPersonal,
            incomeTax,
            otherDeduction,
            totalDeduction,
            netSalary,
            remark: item.remark || null,
          },
        });
      }

      const allItems = await prisma.salaryBatchItem.findMany({ where: { batchId: id } });
      const totalGrossSalary = allItems.reduce((s, i) => s + Number(i.grossSalary), 0);
      const totalSIPersonal = allItems.reduce((s, i) => s + Number(i.socialInsurancePersonal), 0);
      const totalSICompany = allItems.reduce((s, i) => s + Number(i.socialInsuranceCompany), 0);
      const totalHFPersonal = allItems.reduce((s, i) => s + Number(i.housingFundPersonal), 0);
      const totalHFCompany = allItems.reduce((s, i) => s + Number(i.housingFundCompany), 0);
      const totalIncomeTax = allItems.reduce((s, i) => s + Number(i.incomeTax), 0);
      const totalOtherDeduction = allItems.reduce((s, i) => s + Number(i.otherDeduction), 0);
      const totalNetSalary = allItems.reduce((s, i) => s + Number(i.netSalary), 0);
      const totalBankOutflow = totalNetSalary + totalSIPersonal + totalSICompany + totalHFPersonal + totalHFCompany;

      await prisma.salaryBatch.update({
        where: { id },
        data: {
          totalGrossSalary,
          totalSocialInsurancePersonal: totalSIPersonal,
          totalSocialInsuranceCompany: totalSICompany,
          totalHousingFundPersonal: totalHFPersonal,
          totalHousingFundCompany: totalHFCompany,
          totalIncomeTax,
          totalOtherDeduction,
          totalNetSalary,
          totalBankOutflow,
          employeeCount: allItems.length,
        },
      });
    }

    const updateData: Record<string, unknown> = { lastModifiedBy: currentUser?.realName || null };
    if (title !== undefined) updateData.title = title;
    if (remark !== undefined) updateData.remark = remark?.trim() || null;
    if (status !== undefined) updateData.status = status;
    if (bankAccountId !== undefined) updateData.bankAccountId = bankAccountId;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (paidAt !== undefined) updateData.paidAt = paidAt ? new Date(paidAt) : null;

    const batch = await prisma.salaryBatch.update({
      where: { id },
      data: updateData,
      select: batchSelect,
    });

    return NextResponse.json({ data: batch });
  } catch (error) {
    console.error("更新批次失败:", error);
    return NextResponse.json({ error: "更新批次失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.salaryBatch.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "批次不存在" }, { status: 404 });

    const deleteCheck = await checkDeletePermission("salary_payment", undefined, existing.status, existing.createdById);
    if (!deleteCheck.allowed) {
      return NextResponse.json({ error: deleteCheck.error }, { status: 403 });
    }

    await cleanupBusinessApprovalRecords("salary_payment", id);
    await prisma.salaryBatch.delete({ where: { id } });
    return NextResponse.json({ message: "批次已删除" });
  } catch (error) {
    console.error("删除批次失败:", error);
    return NextResponse.json({ error: "删除批次失败" }, { status: 500 });
  }
}
