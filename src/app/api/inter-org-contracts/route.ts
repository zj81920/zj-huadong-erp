import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const orgId = searchParams.get('orgId');
  const relatedContractId = searchParams.get('relatedContractId');
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (relatedContractId) where.relatedContractId = relatedContractId;
  if (orgId) {
    where.OR = [{ fromOrgId: orgId }, { toOrgId: orgId }];
  }

  const [contracts, total] = await Promise.all([
    prisma.interOrgContract.findMany({
      where,
      include: { fromOrg: true, toOrg: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.interOrgContract.count({ where }),
  ]);

  // 如果有关联收入合同，补充收入合同信息
  for (const contract of contracts as any[]) {
    if (contract.relatedContractId) {
      const incomeContract = await prisma.incomeContract.findUnique({
        where: { id: contract.relatedContractId },
        include: { customer: true, project: true },
      });
      contract.relatedContract = incomeContract;
    }
  }

  return NextResponse.json({
    data: contracts,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  // 计算结算额
  const mainAmount = body.mainContractAmount ? parseFloat(body.mainContractAmount) : 0;
  const mgmtFee = parseFloat(body.managementFee || 0);
  const tax = parseFloat(body.taxBurden || 0);
  const other = parseFloat(body.otherFee || 0);
  const settlementAmount = parseFloat((mainAmount - mgmtFee - tax - other).toFixed(2));

  const existingContract = await prisma.interOrgContract.findUnique({
    where: { contractNo: body.contractNo.trim() },
  });
  if (existingContract) {
    return NextResponse.json({ error: "合同编号已存在" }, { status: 409 });
  }

  const contract = await prisma.interOrgContract.create({
    data: {
      contractNo: body.contractNo,
      contractName: body.contractName,
      fromOrgId: body.fromOrgId,
      toOrgId: body.toOrgId,
      type: body.type || 'MANAGEMENT_FEE',
      relatedContractId: body.relatedContractId || null,
      mainContractAmount: body.mainContractAmount ? parseFloat(body.mainContractAmount) : null,
      managementFee: mgmtFee,
      taxBurden: tax,
      otherFee: other,
      otherFeeNote: body.otherFeeNote || null,
      settlementAmount,
      status: body.status || '草稿',
      remark: body.remark || null,
    },
    include: { fromOrg: true, toOrg: true },
  });

  return NextResponse.json({ data: contract }, { status: 201 });
}
