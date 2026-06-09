import { NextRequest, NextResponse } from 'next/server';
import { indexFileFromOSS } from '@/lib/file-index/index-engine';

export async function POST(request: NextRequest) {
  try {
    const { fileKey, fileName } = await request.json();
    if (!fileKey || !fileName) {
      return NextResponse.json({ error: '缺少 fileKey 或 fileName' }, { status: 400 });
    }
    const recordId = await indexFileFromOSS(fileKey, fileName);
    return NextResponse.json({ recordId, status: 'processing' });
  } catch (error: any) {
    console.error('索引失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
