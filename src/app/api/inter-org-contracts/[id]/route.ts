import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cleanupBusinessApprovalRecords } from '@/lib/approval-cleanup';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const contract = await prisma.interOrgContract.findUnique({
    where: { id },
    include: { fromOrg: true, toOrg: true },
  });
  if (!contract) {
    return NextResponse.json({ error: '未找到' }, { status: 404 });
  }

  // 补充关联收入合同信息
  const result: any = { ...contract };
  if (contract.relatedContractId) {
    const incomeContract = await prisma.incomeContract.findUnique({
      where: { id: contract.relatedContractId },
      include: { customer: true, project: true },
    });
    result.relatedContract = incomeContract;
  }

  // 补充关联应收记录和收款记录
  const receivables = await prisma.receivable.findMany({
    where: { sourceType: 'inter_org_contract', sourceId: id },
    include: { receiptVouchers: true },
  });
  result.receivables = receivables;

  // 补充关联发票
  const invoices = await prisma.invoice.findMany({
    where: { sourceType: 'inter_org_contract', sourceId: id },
  });
  result.invoices = invoices;

  return NextResponse.json({ data: result });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // 计算结算额
  const mainAmount = body.mainContractAmount ? parseFloat(body.mainContractAmount) : 0;
  const mgmtFee = parseFloat(body.managementFee || 0);
  const tax = parseFloat(body.taxBurden || 0);
  const other = parseFloat(body.otherFee || 0);
  const settlementAmount = parseFloat((mainAmount - mgmtFee - tax - other).toFixed(2));

  const contract = await prisma.interOrgContract.update({
    where: { id },
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
      status: body.status,
      remark: body.remark || null,
      archivedUrl: body.archivedUrl,
    },
  });
  return NextResponse.json({ data: contract });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // 删除前清空关联收入合同标记
  const contract = await prisma.interOrgContract.findUnique({
    where: { id },
    select: { relatedContractId: true },
  });
  if (contract?.relatedContractId) {
    await prisma.incomeContract.update({
      where: { id: contract.relatedContractId },
      data: { interOrgContractId: null },
    });
  }
  await cleanupBusinessApprovalRecords("inter_org_contract", id);
  await prisma.interOrgContract.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
