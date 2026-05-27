import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier || !supplier.isActive) {
      return NextResponse.json({ error: "供应商不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: supplier });
  } catch (error) {
    console.error("获取供应商详情失败:", error);
    return NextResponse.json({ error: "获取供应商详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, supplierType, status, contactPerson, phone, email, address, bankName, bankAccount, remark, attachmentUrl } = body;

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing || !existing.isActive) {
      return NextResponse.json({ error: "供应商不存在" }, { status: 404 });
    }

    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.supplier.findFirst({
        where: { name: name.trim(), isActive: true, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json({ error: "该供应商名称已存在" }, { status: 409 });
      }
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(supplierType !== undefined && { supplierType: supplierType || "企业" }),
        ...(status !== undefined && { status: status || "当前有效" }),
        ...(contactPerson !== undefined && { contactPerson: contactPerson?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(bankName !== undefined && { bankName: bankName?.trim() || null }),
        ...(bankAccount !== undefined && { bankAccount: bankAccount?.trim() || null }),
        ...(remark !== undefined && { remark: remark?.trim() || null }),
        ...(attachmentUrl !== undefined && { attachmentUrl: attachmentUrl?.trim() || null }),
      },
    });

    return NextResponse.json({ data: supplier });
  } catch (error) {
    console.error("更新供应商失败:", error);
    return NextResponse.json({ error: "更新供应商失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing || !existing.isActive) {
      return NextResponse.json({ error: "供应商不存在" }, { status: 404 });
    }

    await prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除供应商失败:", error);
    return NextResponse.json({ error: "删除供应商失败" }, { status: 500 });
  }
}
