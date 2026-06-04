import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  const where: Record<string, unknown> = { isActive: true };
  if (type) where.type = type;

  const organizations = await prisma.organization.findMany({
    where,
    orderBy: { sort: 'asc' },
  });

  return NextResponse.json({ data: organizations });
}
