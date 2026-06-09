import { NextResponse } from 'next/server';
import { reconcileOrphanRecords } from '@/lib/file-index/cleanup';

// POST /api/file/index/reconcile
// 清理孤立的向量索引记录（OSS/本地文件已不存在但向量记录还在）
export async function POST() {
  try {
    const result = await reconcileOrphanRecords();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
