import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getSignedUrl, isOSSConfigured } from "@/lib/oss";

/** 从 URL 中提取 OSS key */
function extractOssKey(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\//, "");
  } catch {
    return url;
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "未登录", data: null },
        { status: 401 }
      );
    }

    // 查询签名 URL（getCurrentUser 不含此字段，需单独获取）
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { signatureUrl: true },
    });

    let signatureUrl: string | null = null;
    if (dbUser?.signatureUrl) {
      try {
        const key = extractOssKey(dbUser.signatureUrl);
        signatureUrl = isOSSConfigured() ? getSignedUrl(key, 7 * 24 * 3600) : dbUser.signatureUrl;
      } catch {
        signatureUrl = dbUser.signatureUrl;
      }
    }

    return NextResponse.json({ data: { ...user, signatureUrl } });
  } catch (error) {
    console.error("获取当前用户失败:", error);
    return NextResponse.json({ error: "获取当前用户失败" }, { status: 500 });
  }
}
