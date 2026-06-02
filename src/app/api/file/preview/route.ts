import { NextRequest, NextResponse } from "next/server";
import { getSignedUrl, isOSSConfigured } from "@/lib/oss";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "缺少文件 key 参数" }, { status: 400 });
  }

  if (!isOSSConfigured()) {
    return NextResponse.json({ error: "OSS 未配置" }, { status: 500 });
  }

  try {
    const signedUrl = getSignedUrl(key, 3600);
    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error("生成签名 URL 失败:", error);
    return NextResponse.json({ error: "生成签名 URL 失败" }, { status: 500 });
  }
}
