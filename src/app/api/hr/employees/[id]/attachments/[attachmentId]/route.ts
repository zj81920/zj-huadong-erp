import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { attachmentId } = await params;

    const attachment = await prisma.employeeAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return NextResponse.json({ error: "附件不存在" }, { status: 404 });
    }

    await prisma.employeeAttachment.delete({
      where: { id: attachmentId },
    });

    return NextResponse.json({ message: "附件已删除" });
  } catch (error) {
    console.error("删除附件失败:", error);
    return NextResponse.json({ error: "删除附件失败" }, { status: 500 });
  }
}
