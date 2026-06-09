import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { deleteFromOSS, isOSSConfigured } from '@/lib/oss';

// DELETE /api/file/index/:key
// 同时删除 OSS 文件和 pgvector 索引记录（CASCADE 自动清空所有 chunks）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const fileKey = decodeURIComponent(key);

    // 1. 查找并删除 pgvector 记录（FileChunk 由 CASCADE 自动删除）
    const record = await prisma.fileIndexRecord.findUnique({ where: { fileKey } });
    if (!record) {
      return NextResponse.json({ error: '索引记录不存在', fileKey }, { status: 404 });
    }

    await prisma.fileIndexRecord.delete({ where: { fileKey } });

    // 2. 如果配置了 OSS，删除 OSS 文件
    let ossDeleted = false;
    if (isOSSConfigured()) {
      try {
        await deleteFromOSS(fileKey);
        ossDeleted = true;
      } catch (ossError: any) {
        console.warn(`OSS 文件删除失败 (${fileKey}):`, ossError.code || ossError.message);
        // OSS 删除失败不影响向量记录删除（已成功）
      }
    }

    return NextResponse.json({
      success: true,
      fileKey,
      fileName: record.fileName,
      ossDeleted,
    });
  } catch (error: any) {
    console.error('删除索引记录失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
