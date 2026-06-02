import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("开始清理测试数据...\n");

  // ========== 第1步：识别所有可匹配模式的测试数据根记录 ==========
  console.log("【第1步】识别测试数据根记录...");

  // 客户：name 包含 "综合测试客户-"
  const customers = await prisma.customer.findMany({
    where: { name: { contains: "综合测试客户-" } },
    select: { id: true, name: true },
  });
  console.log(`  找到 ${customers.length} 个测试客户`);

  // 供应商：name 包含 "综合测试供应商-"
  const suppliers = await prisma.supplier.findMany({
    where: { name: { contains: "综合测试供应商-" } },
    select: { id: true, name: true },
  });
  console.log(`  找到 ${suppliers.length} 个测试供应商`);

  // 项目线索：projectName 包含 "市场开发投标" 或 "综合测试"
  const projectLeads = await prisma.projectLead.findMany({
    where: {
      OR: [
        { projectName: { contains: "市场开发投标" } },
        { projectName: { contains: "综合测试" } },
      ],
    },
    select: { id: true, projectSourceId: true, projectName: true },
  });
  console.log(`  找到 ${projectLeads.length} 个测试项目线索`);

  // 项目：name 包含 "综合测试项目-"
  const projects = await prisma.project.findMany({
    where: { name: { contains: "综合测试项目-" } },
    select: { id: true, projectSourceId: true, name: true },
  });
  console.log(`  找到 ${projects.length} 个测试项目`);

  // 银行账户：name 包含 "测试银行账户"
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { accountName: { contains: "测试银行账户" } },
    select: { id: true, accountName: true },
  });
  console.log(`  找到 ${bankAccounts.length} 个测试银行账户`);

  // 汇总所有需要删除的根 ID
  const customerIds = customers.map((c) => c.id);
  const supplierIds = suppliers.map((s) => s.id);
  const projectSourceIds = projectLeads.map((p) => p.projectSourceId).concat(projects.map((p) => p.projectSourceId));
  const bankAccountIds = bankAccounts.map((b) => b.id);

  // ========== 第2步：根据根 ID 查找所有关联业务数据 ==========
  console.log("\n【第2步】查找关联业务数据...");

  // 通过项目线索找到报价和投标
  const quotations = projectSourceIds.length > 0
    ? await prisma.quotation.findMany({
        where: { projectSourceId: { in: projectSourceIds } },
        select: { id: true },
      })
    : [];
  console.log(`  找到 ${quotations.length} 个测试报价`);

  const biddings = projectSourceIds.length > 0
    ? await prisma.bidding.findMany({
        where: { projectSourceId: { in: projectSourceIds } },
        select: { id: true },
      })
    : [];
  console.log(`  找到 ${biddings.length} 个测试投标`);

  // 通过客户找到收入合同
  const customerIdsForContract = customerIds.length > 0 ? customerIds : [""];
  const incomeContracts = customerIdsForContract[0]
    ? await prisma.incomeContract.findMany({
        where: { customerId: { in: customerIdsForContract } },
        select: { id: true, contractNo: true },
      })
    : [];
  console.log(`  找到 ${incomeContracts.length} 个测试收入合同`);

  // 通过供应商找到支出合同
  const supplierIdsForContract = supplierIds.length > 0 ? supplierIds : [""];
  const expenseContracts = supplierIdsForContract[0]
    ? await prisma.expenseContract.findMany({
        where: { supplierId: { in: supplierIdsForContract } },
        select: { id: true, contractNo: true },
      })
    : [];
  console.log(`  找到 ${expenseContracts.length} 个测试支出合同`);

  // 也通过项目线索查找合同（可能有项目线索但无客户的合同）
  const incomeByProject = projectSourceIds.length > 0
    ? await prisma.incomeContract.findMany({
        where: { projectSourceId: { in: projectSourceIds } },
        select: { id: true },
      })
    : [];
  const expenseByProject = projectSourceIds.length > 0
    ? await prisma.expenseContract.findMany({
        where: { projectSourceId: { in: projectSourceIds } },
        select: { id: true },
      })
    : [];

  // 合并所有合同 ID
  const incomeContractIds = [...new Set([...incomeContracts.map((c) => c.id), ...incomeByProject.map((c) => c.id)])];
  const expenseContractIds = [...new Set([...expenseContracts.map((c) => c.id), ...expenseByProject.map((c) => c.id)])];

  // 通过 sourceType + sourceId 找到应收/应付
  const receivables: { id: string }[] = [];
  const payables: { id: string }[] = [];
  if (incomeContractIds.length > 0) {
    const r = await prisma.receivable.findMany({
      where: { sourceType: "income_contract", sourceId: { in: incomeContractIds } },
      select: { id: true },
    });
    receivables.push(...r);
  }
  if (expenseContractIds.length > 0) {
    const p = await prisma.payable.findMany({
      where: { sourceType: "expense_contract", sourceId: { in: expenseContractIds } },
      select: { id: true },
    });
    payables.push(...p);
  }
  console.log(`  找到 ${receivables.length} 个测试应收记录`);
  console.log(`  找到 ${payables.length} 个测试应付记录`);

  // 通过应付找到付款申请
  const payableIds = payables.map((p) => p.id);
  const paymentApplications = payableIds.length > 0
    ? await prisma.paymentApplication.findMany({
        where: { payableId: { in: payableIds } },
        select: { id: true },
      })
    : [];
  console.log(`  找到 ${paymentApplications.length} 个测试付款申请`);

  // 通过应收找到收款凭证
  const receivableIds = receivables.map((r) => r.id);
  const receiptVouchers = receivableIds.length > 0
    ? await prisma.receiptVoucher.findMany({
        where: { receivableId: { in: receivableIds } },
        select: { id: true },
      })
    : [];
  console.log(`  找到 ${receiptVouchers.length} 个测试收款凭证`);

  // 通过付款申请找到付款凭证
  const paymentApplicationIds = paymentApplications.map((p) => p.id);
  const paymentVouchers = paymentApplicationIds.length > 0
    ? await prisma.paymentVoucher.findMany({
        where: { paymentApplicationId: { in: paymentApplicationIds } },
        select: { id: true },
      })
    : [];
  console.log(`  找到 ${paymentVouchers.length} 个测试付款凭证`);

  // 查找工资批次（标题包含 "综合测试"）
  const salaryBatches = await prisma.salaryBatch.findMany({
    where: { title: { contains: "综合测试" } },
    select: { id: true },
  });
  console.log(`  找到 ${salaryBatches.length} 个测试工资批次`);

  // 查找所有非合同支出（通过项目线索关联）
  const otherPaymentsByProject = projectSourceIds.length > 0
    ? await prisma.nonContractExpense.findMany({
        where: { projectSourceId: { in: projectSourceIds } },
        select: { id: true },
      })
    : [];
  console.log(`  找到 ${otherPaymentsByProject.length} 个测试非合同支出`);

  // 查找费用报销（通过项目线索关联）
  const expenseReportsByProject = projectSourceIds.length > 0
    ? await prisma.expenseReport.findMany({
        where: { projectSourceId: { in: projectSourceIds } },
        select: { id: true },
      })
    : [];
  console.log(`  找到 ${expenseReportsByProject.length} 个测试费用报销`);

  // 查找借出款（通过项目线索关联）
  const lendingOutsByProject = projectSourceIds.length > 0
    ? await prisma.lendingOut.findMany({
        where: { projectSourceId: { in: projectSourceIds } },
        select: { id: true },
      })
    : [];
  console.log(`  找到 ${lendingOutsByProject.length} 个测试借出款`);

  // 查找其他借入款（通过借出款关联 + lenderName 模式）
  const otherBorrowingsByName = await prisma.otherBorrowing.findMany({
    where: { lenderName: { contains: "某金融" } },
    select: { id: true },
  });
  console.log(`  找到 ${otherBorrowingsByName.length} 个测试其他借入款`);

  // 查找借入资金归还申请（通过 sourceType=other_borrowing + sourceId 关联）
  const otherBorrowingIds = otherBorrowingsByName.map((o) => o.id);
  const borrowingReturnApps = otherBorrowingIds.length > 0
    ? await prisma.borrowingReturnApplication.findMany({
        where: { sourceType: "other_borrowing", sourceId: { in: otherBorrowingIds } },
        select: { id: true },
      })
    : [];
  console.log(`  找到 ${borrowingReturnApps.length} 个测试借入资金归还申请`);

  // 查找所有测试数据涉及的 approval instances
  const allBusinessIds = [
    ...incomeContractIds,
    ...expenseContractIds,
    ...quotations.map((q) => q.id),
    ...paymentApplications.map((p) => p.id),
    ...otherPaymentsByProject.map((o) => o.id),
    ...expenseReportsByProject.map((e) => e.id),
    ...lendingOutsByProject.map((l) => l.id),
    ...salaryBatches.map((s) => s.id),
    ...borrowingReturnApps.map((b) => b.id),
    ...otherBorrowingsByName.map((o) => o.id),
  ];
  const allBusinessTypes = [
    ...incomeContractIds.map(() => "income_contract"),
    ...expenseContractIds.map(() => "expense_contract"),
    ...quotations.map(() => "quotation"),
    ...paymentApplications.map(() => "payment_application"),
    ...otherPaymentsByProject.map(() => "other_payment"),
    ...expenseReportsByProject.map(() => "expense_report"),
    ...lendingOutsByProject.map(() => "lending_out"),
    ...salaryBatches.map(() => "salary_batch"),
    ...borrowingReturnApps.map(() => "borrowing_return_application"),
    ...otherBorrowingsByName.map(() => "other_borrowing"),
  ];

  // 还可能有 projectSourceId 关联的审批实例
  const approvalInstances: { id: string }[] = [];
  if (allBusinessIds.length > 0) {
    const instances = await prisma.approvalInstance.findMany({
      where: {
        OR: [
          { businessId: { in: allBusinessIds } },
          { businessId: { in: projectSourceIds } },
        ],
      },
      select: { id: true, businessType: true, businessId: true },
    });
    approvalInstances.push(...instances);
  }

  // 也可能通过 businessType + businessId 模式在 project_leads 上
  const leadInstances = projectSourceIds.length > 0
    ? await prisma.approvalInstance.findMany({
        where: { businessId: { in: projectSourceIds } },
        select: { id: true },
      })
    : [];
  
  const allInstanceIds = [...new Set([...approvalInstances.map((a) => a.id), ...leadInstances.map((a) => a.id)])];
  console.log(`  找到 ${allInstanceIds.length} 个测试审批实例`);

  // 查找审批动作
  const approvalActions = allInstanceIds.length > 0
    ? await prisma.approvalAction.findMany({
        where: { instanceId: { in: allInstanceIds } },
        select: { id: true },
      })
    : [];
  console.log(`  找到 ${approvalActions.length} 个测试审批动作`);

  // 计算总计
  const totalRecords =
    customers.length +
    suppliers.length +
    projectLeads.length +
    projects.length +
    bankAccounts.length +
    quotations.length +
    biddings.length +
    incomeContractIds.length +
    expenseContractIds.length +
    receivables.length +
    payables.length +
    paymentApplications.length +
    receiptVouchers.length +
    paymentVouchers.length +
    salaryBatches.length +
    otherPaymentsByProject.length +
    expenseReportsByProject.length +
    lendingOutsByProject.length +
    otherBorrowingsByName.length +
    borrowingReturnApps.length +
    allInstanceIds.length +
    approvalActions.length;

  if (totalRecords === 0) {
    console.log("\n⚠️  未找到任何测试数据，无需清理。");
    return;
  }

  console.log(`\n📊 共找到 ${totalRecords} 条测试记录，开始清理...\n`);

  // ========== 第3步：按 FK 反向顺序删除 ==========
  console.log("【第3步】开始删除数据...");

  // 3.1 审批动作（子表）
  if (approvalActions.length > 0) {
    const actionIds = approvalActions.map((a) => a.id);
    await prisma.approvalAction.deleteMany({ where: { id: { in: actionIds } } });
    console.log(`  ✅ 删除 ${actionIds.length} 条审批动作`);
  }

  // 3.2 审批实例
  if (allInstanceIds.length > 0) {
    await prisma.approvalInstance.deleteMany({ where: { id: { in: allInstanceIds } } });
    console.log(`  ✅ 删除 ${allInstanceIds.length} 条审批实例`);
  }

  // 3.3 收款凭证（子表）
  if (receiptVouchers.length > 0) {
    const voucherIds = receiptVouchers.map((v) => v.id);
    await prisma.receiptVoucher.deleteMany({ where: { id: { in: voucherIds } } });
    console.log(`  ✅ 删除 ${voucherIds.length} 条收款凭证`);
  }

  // 3.4 付款凭证（子表）
  if (paymentVouchers.length > 0) {
    const voucherIds = paymentVouchers.map((v) => v.id);
    await prisma.paymentVoucher.deleteMany({ where: { id: { in: voucherIds } } });
    console.log(`  ✅ 删除 ${voucherIds.length} 条付款凭证`);
  }

  // 3.5 付款申请（子表）
  if (paymentApplicationIds.length > 0) {
    await prisma.paymentApplication.deleteMany({ where: { id: { in: paymentApplicationIds } } });
    console.log(`  ✅ 删除 ${paymentApplicationIds.length} 条付款申请`);
  }

  // 3.6 应付记录（子表）
  if (payableIds.length > 0) {
    await prisma.payable.deleteMany({ where: { id: { in: payableIds } } });
    console.log(`  ✅ 删除 ${payableIds.length} 条应付记录`);
  }

  // 3.7 应收记录（子表）
  if (receivableIds.length > 0) {
    await prisma.receivable.deleteMany({ where: { id: { in: receivableIds } } });
    console.log(`  ✅ 删除 ${receivableIds.length} 条应收记录`);
  }

  // 3.8 收入合同
  if (incomeContractIds.length > 0) {
    await prisma.incomeContract.deleteMany({ where: { id: { in: incomeContractIds } } });
    console.log(`  ✅ 删除 ${incomeContractIds.length} 条收入合同`);
  }

  // 3.9 支出合同
  if (expenseContractIds.length > 0) {
    await prisma.expenseContract.deleteMany({ where: { id: { in: expenseContractIds } } });
    console.log(`  ✅ 删除 ${expenseContractIds.length} 条支出合同`);
  }

  // 3.10 费用报销（子表 ExpenseReportItem 有 onDelete Cascade，自动删除）
  if (expenseReportsByProject.length > 0) {
    const erIds = expenseReportsByProject.map((e) => e.id);
    await prisma.expenseReport.deleteMany({ where: { id: { in: erIds } } });
    console.log(`  ✅ 删除 ${erIds.length} 条费用报销`);
  }

  // 3.11 工资批次（子表 SalaryBatchItem 有 onDelete Cascade，自动删除）
  if (salaryBatches.length > 0) {
    const sbIds = salaryBatches.map((s) => s.id);
    await prisma.salaryBatch.deleteMany({ where: { id: { in: sbIds } } });
    console.log(`  ✅ 删除 ${sbIds.length} 条工资批次`);
  }

  // 3.12 非合同支出
  if (otherPaymentsByProject.length > 0) {
    const opIds = otherPaymentsByProject.map((o) => o.id);
    await prisma.nonContractExpense.deleteMany({ where: { id: { in: opIds } } });
    console.log(`  ✅ 删除 ${opIds.length} 条非合同支出`);
  }

  // 3.13 借出款
  if (lendingOutsByProject.length > 0) {
    const loIds = lendingOutsByProject.map((l) => l.id);
    await prisma.lendingOut.deleteMany({ where: { id: { in: loIds } } });
    console.log(`  ✅ 删除 ${loIds.length} 条借出款`);
  }

  // 3.14 借入资金归还申请
  if (borrowingReturnApps.length > 0) {
    const braIds = borrowingReturnApps.map((b) => b.id);
    await prisma.borrowingReturnApplication.deleteMany({ where: { id: { in: braIds } } });
    console.log(`  ✅ 删除 ${braIds.length} 条借入资金归还申请`);
  }

  // 3.15 先删除 BorrowingReturn（子表），再删除 OtherBorrowing（父表）
  if (otherBorrowingIds.length > 0) {
    await prisma.borrowingReturn.deleteMany({ where: { borrowingId: { in: otherBorrowingIds } } });
    console.log(`  ✅ 删除 BorrowingReturn 子记录`);
  }
  if (otherBorrowingsByName.length > 0) {
    const obIds = otherBorrowingsByName.map((o) => o.id);
    await prisma.otherBorrowing.deleteMany({ where: { id: { in: obIds } } });
    console.log(`  ✅ 删除 ${obIds.length} 条其他借入款`);
  }

  // 3.16 投标
  if (biddings.length > 0) {
    const bidIds = biddings.map((b) => b.id);
    await prisma.bidding.deleteMany({ where: { id: { in: bidIds } } });
    console.log(`  ✅ 删除 ${bidIds.length} 条投标记录`);
  }

  // 3.17 报价
  if (quotations.length > 0) {
    const qIds = quotations.map((q) => q.id);
    await prisma.quotation.deleteMany({ where: { id: { in: qIds } } });
    console.log(`  ✅ 删除 ${qIds.length} 条报价`);
  }

  // 3.18 项目
  if (projects.length > 0) {
    const pIds = projects.map((p) => p.id);
    await prisma.project.deleteMany({ where: { id: { in: pIds } } });
    console.log(`  ✅ 删除 ${pIds.length} 条项目`);
  }

  // 3.19 项目线索
  if (projectLeads.length > 0) {
    const plIds = projectLeads.map((p) => p.id);
    await prisma.projectLead.deleteMany({ where: { id: { in: plIds } } });
    console.log(`  ✅ 删除 ${plIds.length} 条项目线索`);
  }

  // 3.20 供应商
  if (supplierIds.length > 0) {
    await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
    console.log(`  ✅ 删除 ${supplierIds.length} 条供应商`);
  }

  // 3.21 客户
  if (customerIds.length > 0) {
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    console.log(`  ✅ 删除 ${customerIds.length} 条客户`);
  }

  // 3.22 测试银行账户
  if (bankAccountIds.length > 0) {
    await prisma.bankAccount.deleteMany({ where: { id: { in: bankAccountIds } } });
    console.log(`  ✅ 删除 ${bankAccountIds.length} 个测试银行账户`);
  }

  console.log("\n🎉 所有测试数据清理完成！");
}

main()
  .catch((e) => {
    console.error("清理失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
