import { NextRequest, NextResponse } from "next/server";
import { searchFiles, isOSSConfigured } from "@/lib/oss";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  const maxResults = parseInt(
    request.nextUrl.searchParams.get("max") || "20",
    10
  );

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "请提供搜索关键词参数 q" },
      { status: 400 }
    );
  }

  if (!isOSSConfigured()) {
    return NextResponse.json({ error: "OSS 未配置" }, { status: 500 });
  }

  try {
    const results = await searchFiles(query.trim(), Math.min(maxResults, 100));
    return NextResponse.json({ query: query.trim(), total: results.length, results });
  } catch (error: any) {
    console.error("OSS 语义检索失败:", error);
    return NextResponse.json(
      { error: "语义检索失败", detail: error.message },
      { status: 500 }
    );
  }
}
