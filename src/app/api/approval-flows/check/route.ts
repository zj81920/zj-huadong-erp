import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const businessType = searchParams.get("businessType");

  if (!businessType) {
    return NextResponse.json({ error: "缺少 businessType" }, { status: 400 });
  }

  const count = await prisma.approvalFlowDefinition.count({
    where: { businessType, isActive: true },
  });

  return NextResponse.json({ configured: count > 0 });
}
