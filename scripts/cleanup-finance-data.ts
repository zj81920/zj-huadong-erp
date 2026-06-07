import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const financeBusinessTypes = [
  "income_contract",
  "expense_contract",
  "non_contract_income",
  "non_contract_expense",
  "project_budget",
  "expense_report",
  "loan_request",
  "payment_application",
  "invoice",
  "other_borrowing",
  "salary_payment",
  "salary_batch",
];

async function cleanup() {
  console.log("🧹 开始清理财务管理数据...\n");

  // ========== 第1层：删除审批相关（依赖财务业务数据）==========
  console.log("--- 第1层：删除审批相关数据 ---");

  let deleted = await prisma.approvalAction.deleteMany({
    where: { instance: { businessType: { in: financeBusinessTypes } } },
  });
  console.log(`  删除审批动作: ${deleted.count} 条`);

  deleted = await prisma.approvalInstance.deleteMany({
    where: { businessType: { in: financeBusinessTypes } },
  });
  console.log(`  删除审批实例: ${deleted.count} 条`);

  // ========== 第2层：删除子表（依赖主财务表）==========
  console.log("\n--- 第2层：删除子表数据 ---");

  // 借入归还（依赖 OtherBorrowing）
  deleted = await prisma.borrowingReturn.deleteMany({});
  console.log(`  删除借入归还记录: ${deleted.count} 条`);

  // 借出款归还（依赖 LendingOut）
  deleted = await prisma.lendingReturn.deleteMany({});
  console.log(`  删除借出款归还记录: ${deleted.count} 条`);

  // 出资归还（依赖 CapitalContribution）
  deleted = await prisma.capitalReturn.deleteMany({});
  console.log(`  删除出资归还记录: ${deleted.count} 条`);

  // 股权变更（依赖 Shareholder）
  deleted = await prisma.equityChange.deleteMany({});
  console.log(`  删除股权变更记录: ${deleted.count} 条`);

  // 出资记录（依赖 Shareholder）
  deleted = await prisma.capitalContribution.deleteMany({});
  console.log(`  删除出资记录: ${deleted.count} 条`);

  // 工资批次明细（依赖 SalaryBatch）
  deleted = await prisma.salaryBatchItem.deleteMany({});
  console.log(`  删除工资批次明细: ${deleted.count} 条`);

  // 收款凭证（依赖 Receivable）
  deleted = await prisma.receiptVoucher.deleteMany({});
  console.log(`  删除收款凭证: ${deleted.count} 条`);

  // 付款凭证（依赖 PaymentApplication）
  deleted = await prisma.paymentVoucher.deleteMany({});
  console.log(`  删除付款凭证: ${deleted.count} 条`);

  // WARNING: ExpenseContractItem 和 ExpenseReportItem 虽然设置了 onDelete: Cascade，
  // 但为了确保清理彻底，先显式删除
  deleted = await prisma.expenseContractItem.deleteMany({});
  console.log(`  删除支出合同明细: ${deleted.count} 条`);

  deleted = await prisma.expenseReportItem.deleteMany({});
  console.log(`  删除费用报销明细: ${deleted.count} 条`);

  // ========== 第3层：删除主财务表 ==========
  console.log("\n--- 第3层：删除主财务表数据 ---");

  // 付款申请（依赖 Payable）
  deleted = await prisma.paymentApplication.deleteMany({});
  console.log(`  删除付款申请: ${deleted.count} 条`);

  // 应收款
  deleted = await prisma.receivable.deleteMany({});
  console.log(`  删除应收款: ${deleted.count} 条`);

  // 应付款
  deleted = await prisma.payable.deleteMany({});
  console.log(`  删除应付款: ${deleted.count} 条`);

  // 费用报销
  deleted = await prisma.expenseReport.deleteMany({});
  console.log(`  删除费用报销: ${deleted.count} 条`);

  // 支出合同
  deleted = await prisma.expenseContract.deleteMany({});
  console.log(`  删除支出合同: ${deleted.count} 条`);

  // 收入合同
  deleted = await prisma.incomeContract.deleteMany({});
  console.log(`  删除收入合同: ${deleted.count} 条`);

  // 非合同收入
  deleted = await prisma.nonContractIncome.deleteMany({});
  console.log(`  删除非合同收入: ${deleted.count} 条`);

  // 其他支出
  deleted = await prisma.nonContractExpense.deleteMany({});
  console.log(`  删除其他支出: ${deleted.count} 条`);

  // 发票
  deleted = await prisma.invoice.deleteMany({});
  console.log(`  删除发票: ${deleted.count} 条`);

  // 借入资金归还申请
  deleted = await prisma.borrowingReturnApplication.deleteMany({});
  console.log(`  删除借入资金归还申请: ${deleted.count} 条`);

  // 其他借入款
  deleted = await prisma.otherBorrowing.deleteMany({});
  console.log(`  删除其他借入款: ${deleted.count} 条`);

  // 借出款
  deleted = await prisma.lendingOut.deleteMany({});
  console.log(`  删除借出款: ${deleted.count} 条`);

  // 借款申请
  deleted = await prisma.loanRequest.deleteMany({});
  console.log(`  删除借款申请: ${deleted.count} 条`);

  // 项目预算
  deleted = await prisma.projectBudget.deleteMany({});
  console.log(`  删除项目预算: ${deleted.count} 条`);

  // 工资发放
  deleted = await prisma.salaryPayment.deleteMany({});
  console.log(`  删除工资发放: ${deleted.count} 条`);

  // 工资批次
  deleted = await prisma.salaryBatch.deleteMany({});
  console.log(`  删除工资批次: ${deleted.count} 条`);

  // 股东
  deleted = await prisma.shareholder.deleteMany({});
  console.log(`  删除股东: ${deleted.count} 条`);

  // ========== 第4层：独立表 ==========
  console.log("\n--- 第4层：删除独立表数据 ---");

  // 银行账户
  deleted = await prisma.bankAccount.deleteMany({});
  console.log(`  删除银行账户: ${deleted.count} 条`);

  console.log("\n✅ 财务管理数据清理完成！");
}

cleanup()
  .catch((e) => {
    console.error("❌ 清理失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
