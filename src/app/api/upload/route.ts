import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from "fs";
import path from "path";
import os from "os";
import { indexFile } from "@/lib/file-index/index-engine";
import { isOSSConfigured, uploadToOSS, getSignedUrl } from "@/lib/oss";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "zip",
  "rar",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "webp",
  "svg",
  "tiff",
  "tif",
];

/** 需要进行向量化索引的业务模块 */
const INDEXABLE_MODULES = ["contracts", "procurement", "suppliers"];

export async function POST(request: NextRequest) {
  try {
    const module = request.nextUrl.searchParams.get("module") || "";
    const shouldIndex = INDEXABLE_MODULES.includes(module);
    
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "未提供文件" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "文件大小超过20MB限制" },
        { status: 400 }
      );
    }

    const originalName = file.name;
    const ext = originalName.split(".").pop()?.toLowerCase();

    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "不支持的文件类型" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}-${random}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // ==== 1. 保存到临时目录（供向量化使用）====
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'upload-'));
    const tmpPath = path.join(tmpDir, filename);
    writeFileSync(tmpPath, buffer);

    // ==== 2. 如果配置了 OSS，上传到 OSS ====
    let fileUrl: string;
    let fileKey: string;
    const useOSS = isOSSConfigured();

    if (useOSS) {
      const ossResult = await uploadToOSS(buffer, originalName, 'uploads');
      fileUrl = ossResult.url;
      fileKey = ossResult.key;
    } else {
      // 本地模式：保存到 uploads 目录
      const uploadDir = path.join(process.cwd(), 'uploads');
      mkdirSync(uploadDir, { recursive: true });
      const localPath = path.join(uploadDir, filename);
      writeFileSync(localPath, buffer);
      fileUrl = `/uploads/${filename}`;
      fileKey = `/uploads/${filename}`;
    }

    // ==== 3. 向量化（仅限合同/采购/供应商模块）====
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      txt: "text/plain",
      csv: "text/csv",
    };
    const mimeType = mimeMap[ext] || "application/octet-stream";
    if (shouldIndex && mimeMap[ext]) {
      indexFile(tmpPath, mimeType, originalName, fileKey).catch((err) => {
        console.error(`文件索引失败: ${filename}`, err);
      }).finally(() => {
        // ==== 4. 向量化完成后删除临时文件 ====
        try { rmSync(tmpDir, { recursive: true }); } catch {}
      });
    } else {
      // 不需要索引的文件，直接清理临时文件
      try { rmSync(tmpDir, { recursive: true }); } catch {}
    }

    const signedUrl = fileKey ? getSignedUrl(fileKey, 7 * 24 * 3600) : fileUrl;

    return NextResponse.json({
      url: fileUrl,
      key: fileKey,
      signedUrl,
      filename: originalName,
    });
  } catch (error) {
    console.error("文件上传失败:", error);
    return NextResponse.json({ error: "文件上传失败" }, { status: 500 });
  }
}
