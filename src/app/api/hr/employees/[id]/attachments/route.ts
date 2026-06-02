import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const attachments = await prisma.employeeAttachment.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: attachments });
  } catch (error) {
    console.error("获取附件列表失败:", error);
    return NextResponse.json({ error: "获取附件列表失败" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    const body = await request.json();
    const { fileName, fileUrl, fileType, fileSize } = body;

    if (!fileName || !fileUrl || !fileType) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const attachment = await prisma.employeeAttachment.create({
      data: {
        userId: id,
        fileName,
        fileUrl,
        fileType,
        fileSize: fileSize || 0,
      },
    });

    return NextResponse.json({ data: attachment }, { status: 201 });
  } catch (error) {
    console.error("创建附件记录失败:", error);
    return NextResponse.json({ error: "创建附件记录失败" }, { status: 500 });
  }
}
