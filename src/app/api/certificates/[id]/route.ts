import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const certificate = await prisma.certificate.findUnique({ where: { id } });

    if (!certificate) {
      return NextResponse.json({ error: "证照不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: certificate });
  } catch (error) {
    console.error("获取证照详情失败:", error);
    return NextResponse.json({ error: "获取证照详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, certNo, certType, issuer, issueDate, expireDate, holder, status, location, remark } = body;

    const existing = await prisma.certificate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "证照不存在" }, { status: 404 });
    }

    const certificate = await prisma.certificate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(certNo !== undefined && { certNo: certNo?.trim() || null }),
        ...(certType !== undefined && { certType: certType || null }),
        ...(issuer !== undefined && { issuer: issuer?.trim() || null }),
        ...(issueDate !== undefined && { issueDate: issueDate ? new Date(issueDate) : null }),
        ...(expireDate !== undefined && { expireDate: expireDate ? new Date(expireDate) : null }),
        ...(holder !== undefined && { holder: holder?.trim() || null }),
        ...(status !== undefined && { status }),
        ...(location !== undefined && { location: location?.trim() || null }),
        ...(remark !== undefined && { remark: remark?.trim() || null }),
      },
    });

    return NextResponse.json({ data: certificate });
  } catch (error) {
    console.error("更新证照失败:", error);
    return NextResponse.json({ error: "更新证照失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.certificate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "证照不存在" }, { status: 404 });
    }

    await prisma.certificate.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除证照失败:", error);
    return NextResponse.json({ error: "删除证照失败" }, { status: 500 });
  }
}
