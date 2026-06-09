import prisma from '@/lib/prisma';
import { deleteFromOSS, isOSSConfigured, ossFileExists } from '@/lib/oss';
import fs from 'fs';
import path from 'path';

export async function cleanupFileRecord(recordId: string, fileKey?: string): Promise<void> {
  let actualFileKey = fileKey;
  try {
    if (!actualFileKey) {
      const record = await prisma.fileIndexRecord.delete({
        where: { id: recordId }, select: { fileKey: true },
      });
      actualFileKey = record.fileKey;
    } else {
      await prisma.fileIndexRecord.delete({ where: { id: recordId } });
    }
    try { if (actualFileKey) await deleteFromOSS(actualFileKey); }
    catch (ossError) { console.warn(`OSS 文件删除失败 (${actualFileKey}):`, ossError); }
  } catch (error) {
    console.error(`清理文件记录失败 (${recordId}):`, error);
    throw error;
  }
}

export async function cleanupFileByKey(fileKey: string): Promise<void> {
  await prisma.fileIndexRecord.delete({ where: { fileKey } });
  try { await deleteFromOSS(fileKey); }
  catch (ossError) { console.warn(`OSS 文件删除失败 (${fileKey}):`, ossError); }
}

// 清理孤立的向量索引记录（OSS 文件或本地文件已不存在的记录）
export async function reconcileOrphanRecords(): Promise<{ checked: number; removed: number; errors: string[] }> {
  const records = await prisma.fileIndexRecord.findMany({ select: { id: true, fileKey: true, fileName: true } });
  let removed = 0;
  const errors: string[] = [];
  const useOSS = isOSSConfigured();

  for (const record of records) {
    try {
      let fileExists = false;

      if (useOSS) {
        fileExists = await ossFileExists(record.fileKey);
      } else {
        // 本地模式：检查 uploads 目录
        const localName = path.basename(record.fileKey);
        const localPath = path.join(process.cwd(), 'uploads', localName);
        fileExists = fs.existsSync(localPath);
      }

      if (!fileExists) {
        await prisma.fileIndexRecord.delete({ where: { id: record.id } });
        removed++;
      }
    } catch (e: any) {
      errors.push(`${record.fileName}: ${e.message}`);
    }
  }

  return { checked: records.length, removed, errors };
}
