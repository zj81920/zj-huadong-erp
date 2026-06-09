import prisma from '@/lib/prisma';
import { extractText, getSupportMimeTypes } from './text-extractor';
import { chunkText } from './chunker';
import { getEmbeddings } from '@/lib/ai';
import { isOSSConfigured, getOSSClient } from '@/lib/oss';
import fs from 'fs';
import path from 'path';
import os from 'os';

const storageMode = (process.env.STORAGE_MODE || 'local').toLowerCase();

export async function indexFile(
  filePath: string, mimeType: string, fileName: string, fileKey?: string
): Promise<string> {
  const supported = getSupportMimeTypes();
  if (!supported.includes(mimeType)) {
    throw new Error(`不支持的文件类型: ${mimeType}`);
  }

  const stats = fs.statSync(filePath);

  const record = await prisma.fileIndexRecord.create({
    data: {
      fileKey: fileKey || fileName, fileName,
      fileSize: stats.size, fileType: mimeType,
      status: 'processing',
    },
  });

  try {
    const text = await extractText(filePath, mimeType);
    if (!text) throw new Error('Text extraction result is empty');

    const chunks = chunkText(text);
    const embeddings = await getEmbeddings(chunks.map(c => c.text));

    const chunkData = chunks.map((chunk) => ({
      recordId: record.id, chunkIndex: chunk.index,
      chunkText: chunk.text, tokenCount: Math.ceil(chunk.text.length / 1.4),
    }));

    await prisma.fileChunk.createMany({ data: chunkData });

    for (let i = 0; i < chunks.length; i++) {
      await prisma.$executeRaw`UPDATE file_chunks SET embedding = ${JSON.stringify(embeddings[i])}::vector WHERE record_id = ${record.id} AND chunk_index = ${chunks[i].index}`;
    }

    await prisma.fileIndexRecord.update({
      where: { id: record.id },
      data: { status: 'completed', chunkCount: chunks.length },
    });

    return record.id;
  } catch (error: any) {
    await prisma.fileIndexRecord.update({
      where: { id: record.id },
      data: { status: 'failed', errorMsg: error.message },
    });
    throw error;
  }
}

export async function indexFileFromOSS(fileKey: string, fileName: string): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-index-'));
  const tmpFile = path.join(tmpDir, fileName);

  try {
    const client = getOSSClient();
    await client.get(fileKey, tmpFile);

    const ext = path.extname(fileName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.txt': 'text/plain', '.csv': 'text/csv', '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';

    return await indexFile(tmpFile, mimeType, fileName, fileKey);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }
}

export async function indexAllPending(): Promise<{ total: number; success: number; failed: number }> {
  // 1. 扫描 uploads 目录，为新文件创建待索引记录
  const uploadDir = path.resolve(process.cwd(), 'uploads');
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir);
    const existing = await prisma.fileIndexRecord.findMany({
      where: { fileKey: { in: files.map(f => `/uploads/${f}`) } },
      select: { fileKey: true },
    });
    const existingKeys = new Set(existing.map(r => r.fileKey));

    for (const file of files) {
      const fullPath = path.join(uploadDir, file);
      if (!fs.statSync(fullPath).isFile()) continue;
      const fileKey = `/uploads/${file}`;
      if (existingKeys.has(fileKey)) continue;

      const ext = path.extname(file).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
        '.txt': 'text/plain', '.csv': 'text/csv',
      };
      const mimeType = mimeMap[ext];
      if (!mimeType) continue;

      await prisma.fileIndexRecord.create({
        data: { fileKey, fileName: file, fileSize: fs.statSync(fullPath).size, fileType: mimeType, status: 'pending' },
      });
    }
  }

  // 2. 处理所有待索引和失败的记录
  const pending = await prisma.fileIndexRecord.findMany({
    where: { status: { in: ['pending', 'failed'] } },
  });

  let success = 0, failed = 0;
  for (let i = 0; i < pending.length; i++) {
    const record = pending[i];
    try {
      // 文件之间加延迟，避免触发 API 限流
      if (i > 0) {
        await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
      }

      // 优先尝试本地文件（开发环境可能文件在本地，即使 STORAGE_MODE=oss）
      const localPath = path.join(process.cwd(), record.fileKey);
      if (fs.existsSync(localPath)) {
        await indexFile(localPath, record.fileType, record.fileName, record.fileKey);
      } else if (storageMode === 'oss') {
        await indexFileFromOSS(record.fileKey, record.fileName);
      } else {
        throw new Error(`文件不存在: ${localPath}`);
      }
      success++;
    } catch (e: any) {
      console.error(`[indexAllPending] 文件 ${record.fileName} 索引失败:`, e.message);
      failed++;
    }
  }
  return { total: pending.length, success, failed };
}
