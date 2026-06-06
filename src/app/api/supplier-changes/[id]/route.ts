import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

// 获取单个供应商变更详情（供审批页详情卡片使用）
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await prisma.supplierChange.findUnique({
    where: { id },
    include: {
      supplier: {
        select: { id: true, name: true, supplierType: true, status: true },
      },
    },
  });
  if (!data) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await cleanupBusinessApprovalRecords("supplier_change", id);
  await prisma.supplierChange.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
