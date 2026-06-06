import React from 'react'

// 格式化工具
export { formatDate, formatAmount } from './format'

// 布局组件
export { DetailGrid } from './DetailGrid'

// 各模块 DetailCard
import { SupplierDetailCard } from './suppliers/SupplierDetailCard'
import { SupplierChangeDetailCard } from './suppliers/SupplierChangeDetailCard'
import { QuotationDetailCard } from './business/QuotationDetailCard'
import { OutsourcingDetailCard } from './business/OutsourcingDetailCard'
import { PurchaseRequestDetailCard } from './business/PurchaseRequestDetailCard'
import { DeliveryReceiptDetailCard } from './business/DeliveryReceiptDetailCard'
import { IncomeContractDetailCard } from './contracts/IncomeContractDetailCard'
import { ExpenseContractDetailCard } from './contracts/ExpenseContractDetailCard'
import { InterOrgContractDetailCard } from './contracts/InterOrgContractDetailCard'
import { ContractChangeOrderDetailCard } from './contracts/ContractChangeOrderDetailCard'
import { NonContractIncomeDetailCard } from './finance/NonContractIncomeDetailCard'
import { NonContractExpenseDetailCard } from './finance/NonContractExpenseDetailCard'
import { PaymentApplicationDetailCard } from './finance/PaymentApplicationDetailCard'
import { ExpenseReportDetailCard } from './finance/ExpenseReportDetailCard'
import { LendingOutDetailCard } from './finance/LendingOutDetailCard'
import { SalaryPaymentDetailCard } from './finance/SalaryPaymentDetailCard'
import { BorrowingReturnDetailCard } from './finance/BorrowingReturnDetailCard'
import { OtherBorrowingDetailCard } from './finance/OtherBorrowingDetailCard'
import { InquiryDetailCard } from './business/InquiryDetailCard'

// 注册中心
export const DETAIL_CARD_MAP: Record<string, React.ComponentType<{ data: any }>> = {
  supplier: SupplierDetailCard,
  quotation: QuotationDetailCard,
  outsourcing: OutsourcingDetailCard,
  purchase_request: PurchaseRequestDetailCard,
  delivery_receipt: DeliveryReceiptDetailCard,
  income_contract: IncomeContractDetailCard,
  expense_contract: ExpenseContractDetailCard,
  non_contract_income: NonContractIncomeDetailCard,
  non_contract_expense: NonContractExpenseDetailCard,
  payment_application: PaymentApplicationDetailCard,
  expense_report: ExpenseReportDetailCard,
  lending_out: LendingOutDetailCard,
  salary_payment: SalaryPaymentDetailCard,
  borrowing_return_application: BorrowingReturnDetailCard,
  other_borrowing: OtherBorrowingDetailCard,
  inquiries: InquiryDetailCard,
  inter_org_contract: InterOrgContractDetailCard,
  contract_change_order: ContractChangeOrderDetailCard,
  supplier_change: SupplierChangeDetailCard,
}

// 逐一导出
export { SupplierDetailCard } from './suppliers/SupplierDetailCard'
export { SupplierChangeDetailCard } from './suppliers/SupplierChangeDetailCard'
export { QuotationDetailCard } from './business/QuotationDetailCard'
export { OutsourcingDetailCard } from './business/OutsourcingDetailCard'
export { PurchaseRequestDetailCard } from './business/PurchaseRequestDetailCard'
export { DeliveryReceiptDetailCard } from './business/DeliveryReceiptDetailCard'
export { IncomeContractDetailCard } from './contracts/IncomeContractDetailCard'
export { ExpenseContractDetailCard } from './contracts/ExpenseContractDetailCard'
export { InterOrgContractDetailCard } from './contracts/InterOrgContractDetailCard'
export { ContractChangeOrderDetailCard } from './contracts/ContractChangeOrderDetailCard'
export { NonContractIncomeDetailCard } from './finance/NonContractIncomeDetailCard'
export { NonContractExpenseDetailCard } from './finance/NonContractExpenseDetailCard'
export { PaymentApplicationDetailCard } from './finance/PaymentApplicationDetailCard'
export { ExpenseReportDetailCard } from './finance/ExpenseReportDetailCard'
export { LendingOutDetailCard } from './finance/LendingOutDetailCard'
export { SalaryPaymentDetailCard } from './finance/SalaryPaymentDetailCard'
export { BorrowingReturnDetailCard } from './finance/BorrowingReturnDetailCard'
export { OtherBorrowingDetailCard } from './finance/OtherBorrowingDetailCard'
export { InquiryDetailCard } from './business/InquiryDetailCard'
