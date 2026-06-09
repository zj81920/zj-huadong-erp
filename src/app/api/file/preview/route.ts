import { NextRequest, NextResponse } from "next/server";
import { getOSSClient, isOSSConfigured } from "@/lib/oss";
import fs from "fs";
import path from "path";

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
};

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "缺少文件 key 参数" }, { status: 400 });
  }

  const ext = path.extname(key).toLowerCase();
  const contentType = MIME_MAP[ext] || "application/octet-stream";

  try {
    if (isOSSConfigured()) {
      // OSS 模式：流式获取并返回
      const client = getOSSClient();
      const result = await client.get(key);

      return new NextResponse(new Uint8Array(result.content as Buffer), {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": "inline",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // 本地模式：从 uploads 目录读取
    const localPath = path.join(process.cwd(), key);
    if (!fs.existsSync(localPath)) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }

    const buffer = fs.readFileSync(localPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("文件预览失败:", error);
    return NextResponse.json({ error: "文件预览失败" }, { status: 500 });
  }
}
