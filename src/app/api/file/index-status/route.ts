import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const [total, pending, processing, completed, failed] = await Promise.all([
      prisma.fileIndexRecord.count(),
      prisma.fileIndexRecord.count({ where: { status: 'pending' } }),
      prisma.fileIndexRecord.count({ where: { status: 'processing' } }),
      prisma.fileIndexRecord.count({ where: { status: 'completed' } }),
      prisma.fileIndexRecord.count({ where: { status: 'failed' } }),
    ]);
    return NextResponse.json({ total, pending, processing, completed, failed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
