import { NextResponse } from 'next/server';
import { indexAllPending } from '@/lib/file-index/index-engine';

export async function POST() {
  try {
    const result = await indexAllPending();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
