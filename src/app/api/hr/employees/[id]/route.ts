import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const select = {
  id: true,
  username: true,
  realName: true,
  phone: true,
  email: true,
  role: true,
  department: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employee = await prisma.user.findUnique({
      where: { id },
      select,
    });

    if (!employee) {
      return NextResponse.json({ error: "员工不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: employee });
  } catch (error) {
    console.error("获取员工详情失败:", error);
    return NextResponse.json({ error: "获取员工详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { realName, phone, email, role, department, isActive } = body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "员工不存在" }, { status: 404 });
    }

    const employee = await prisma.user.update({
      where: { id },
      data: {
        ...(realName !== undefined && { realName: realName.trim() }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(role !== undefined && { role }),
        ...(department !== undefined && { department: department || null }),
        ...(isActive !== undefined && { isActive }),
      },
      select,
    });

    return NextResponse.json({ data: employee });
  } catch (error) {
    console.error("更新员工失败:", error);
    return NextResponse.json({ error: "更新员工失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "员工不存在" }, { status: 404 });
    }

    if (!existing.isActive) {
      return NextResponse.json({ error: "该员工已被禁用" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "员工已禁用" });
  } catch (error) {
    console.error("禁用员工失败:", error);
    return NextResponse.json({ error: "禁用员工失败" }, { status: 500 });
  }
}
