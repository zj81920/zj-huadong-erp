import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin, getCurrentUser } from "@/lib/auth";
import { checkDeletePermission, checkEditPermission } from "@/lib/permission-check";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const record = await prisma.salaryPayment.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: "工资发放记录不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("获取工资发放详情失败:", error);
    return NextResponse.json(
      { error: "获取工资发放详情失败" },
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

    const existing = await prisma.salaryPayment.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "工资发放记录不存在" },
        { status: 404 }
      );
    }

    const editCheck = await checkEditPermission("salary_payment", undefined, existing.status, existing.createdById);
    if (!editCheck.allowed) {
      return NextResponse.json({ error: editCheck.error }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.baseSalary !== undefined) updateData.baseSalary = parseFloat(body.baseSalary);
    if (body.bonus !== undefined) updateData.bonus = parseFloat(body.bonus);
    if (body.allowance !== undefined) updateData.allowance = parseFloat(body.allowance);
    if (body.deduction !== undefined) updateData.deduction = parseFloat(body.deduction);
    if (body.netSalary !== undefined) updateData.netSalary = parseFloat(body.netSalary);
    if (body.paymentDate !== undefined) updateData.paymentDate = body.paymentDate ? new Date(body.paymentDate) : null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.remark !== undefined) updateData.remark = body.remark?.trim() || null;

    const record = await prisma.salaryPayment.update({
      where: { id },
      data: updateData,
      include: {
        employee: true,
      },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("更新工资发放失败:", error);
    return NextResponse.json(
      { error: "更新工资发放失败" },
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
    const adminUser = await getCurrentUser();

    const existing = await prisma.salaryPayment.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "工资发放记录不存在" },
        { status: 404 }
      );
    }

    const deleteCheck = await checkDeletePermission("salary_payment", undefined, existing.status, existing.createdById);
    if (!deleteCheck.allowed) {
      return NextResponse.json({ error: deleteCheck.error }, { status: 403 });
    }

    await prisma.salaryPayment.delete({
      where: { id },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除工资发放失败:", error);
    return NextResponse.json(
      { error: "删除工资发放失败" },
      { status: 500 }
    );
  }
}
