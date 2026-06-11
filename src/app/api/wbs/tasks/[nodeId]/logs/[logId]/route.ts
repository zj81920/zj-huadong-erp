import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string; logId: string }> }
) {
  try {
    const { logId } = await params;
    const body = await request.json();
    const log = await prisma.wbsTaskLog.update({
      where: { id: logId },
      data: { content: body.content },
    });
    return NextResponse.json({ data: log });
  } catch (error) {
    console.error("编辑日志失败:", error);
    return NextResponse.json({ error: "编辑日志失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ nodeId: string; logId: string }> }
) {
  try {
    const { logId } = await params;
    await prisma.wbsTaskLog.delete({ where: { id: logId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除日志失败:", error);
    return NextResponse.json({ error: "删除日志失败" }, { status: 500 });
  }
}
