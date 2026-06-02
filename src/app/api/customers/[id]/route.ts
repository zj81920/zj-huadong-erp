import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin, getCurrentUser } from "@/lib/auth";

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
    const { name, address, contactPerson, phone, email, maintainer, industryType, customerGrade } = body;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing || !existing.isActive) {
      return NextResponse.json({ error: "客户不存在" }, { status: 404 });
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
        ...(industryType !== undefined && { industryType: industryType || null }),
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

    const projectLeadsCount = await prisma.projectLead.count({
      where: { customerId: id },
    });

    if (projectLeadsCount > 0 && !isAdmin(adminUser)) {
      return NextResponse.json(
        { error: `该客户下有 ${projectLeadsCount} 条项目线索，无法删除` },
        { status: 400 }
      );
    }

    await prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除客户失败:", error);
    return NextResponse.json({ error: "删除客户失败" }, { status: 500 });
  }
}
