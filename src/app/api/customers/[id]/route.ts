import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin, getCurrentUser } from "@/lib/auth";
import { checkDeletePermission, checkEditPermission } from "@/lib/permission-check";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer || !customer.isActive) {
      return NextResponse.json({ error: "客户不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: customer });
  } catch (error) {
    console.error("获取客户详情失败:", error);
    return NextResponse.json({ error: "获取客户详情失败" }, { status: 500 });
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
    const { name, address, contactPerson, phone, email, maintainer, ownershipType, customerGrade } = body;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing || !existing.isActive) {
      return NextResponse.json({ error: "客户不存在" }, { status: 404 });
    }

    const editCheck = await checkEditPermission("customers", undefined, "草稿", existing.createdById);
    if (!editCheck.allowed) {
      return NextResponse.json({ error: editCheck.error }, { status: 403 });
    }

    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.customer.findFirst({
        where: { name: name.trim(), isActive: true, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json({ error: "该客户名称已存在" }, { status: 409 });
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(contactPerson !== undefined && { contactPerson: contactPerson?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(maintainer !== undefined && { maintainer: maintainer?.trim() || null }),
        ...(ownershipType !== undefined && { ownershipType: ownershipType || null }),
        ...(customerGrade !== undefined && { customerGrade: customerGrade || "C" }),
        lastModifiedBy: currentUser?.realName || null,
      },
    });

    return NextResponse.json({ data: customer });
  } catch (error) {
    console.error("更新客户失败:", error);
    return NextResponse.json({ error: "更新客户失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminUser = await getCurrentUser();

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing || !existing.isActive) {
      return NextResponse.json({ error: "客户不存在" }, { status: 404 });
    }

    const deleteCheck = await checkDeletePermission("customers", undefined, "草稿", existing.createdById);
    if (!deleteCheck.allowed) {
      return NextResponse.json({ error: deleteCheck.error }, { status: 403 });
    }

    // 检查所有引用该客户的关联记录
    const [
      projectLeadsCount,
      projectsCount,
      quotationsCount,
      incomeContractsCount,
    ] = await Promise.all([
      prisma.projectLead.count({ where: { customerId: id } }),
      prisma.project.count({ where: { customerId: id } }),
      prisma.quotation.count({ where: { customerId: id } }),
      prisma.incomeContract.count({ where: { customerId: id } }),
    ]);

    const blockers: string[] = [];
    if (projectLeadsCount > 0) blockers.push(`${projectLeadsCount} 条项目线索`);
    if (projectsCount > 0) blockers.push(`${projectsCount} 个项目`);
    if (quotationsCount > 0) blockers.push(`${quotationsCount} 条报价`);
    if (incomeContractsCount > 0) blockers.push(`${incomeContractsCount} 个收入合同`);

    if (blockers.length > 0 && !isAdmin(adminUser)) {
      return NextResponse.json(
        { error: `该客户下存在关联数据：${blockers.join("、")}，无法删除` },
        { status: 400 }
      );
    }

    if (blockers.length > 0) {
      // 管理员也需清理关联数据后才能删除
      return NextResponse.json(
        { error: `该客户下存在关联数据：${blockers.join("、")}，请先清理后删除` },
        { status: 400 }
      );
    }

    // 物理删除：先级联清理审批记录，再删除业务记录
    await cleanupBusinessApprovalRecords("customer", id);
    await prisma.customer.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除客户失败:", error);
    return NextResponse.json({ error: "删除客户失败" }, { status: 500 });
  }
}
