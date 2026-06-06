import { DetailGrid } from '../DetailGrid'
import { formatAmount } from '../format'

interface Props {
  data: any
}

export function PaymentApplicationDetailCard({ data }: Props) {
  const payable = data?.payable;
  const contract = payable?.sourceContract;
  const outsourcing = payable?.sourceOutsourcing;
  const isOutsourcing = payable?.sourceType === "outsourcing";
  const fields = [
    { label: "申请人", value: data?.applicant?.realName || "-" },
    { label: "付款金额", value: data?.amount ? formatAmount(data.amount) : "-" },
    { label: "付款事由", value: data?.paymentReason || "-" },
    { label: "关联合同", value: isOutsourcing ? `外包-${outsourcing?.targetName || "-"}` : (contract?.contractNo || "-") },
    { label: "交易对方", value: isOutsourcing ? outsourcing?.targetName : contract?.supplier?.name || "-" },
    { label: "合同金额", value: isOutsourcing ? (outsourcing?.amount ? formatAmount(outsourcing.amount) : "-") : (contract?.totalAmount ? formatAmount(contract.totalAmount) : "-") },
    { label: "应付金额", value: payable?.amount ? formatAmount(payable.amount) : "-" },
    { label: "已付金额", value: payable?.paidAmount != null ? formatAmount(payable.paidAmount) : "-" },
    { label: "未付金额", value: payable ? formatAmount((Number(payable.amount) || 0) - (Number(payable.paidAmount) || 0)) : "-" },
    { label: "收款开户行", value: contract?.supplier?.bankName || "-" },
    { label: "收款银行账号", value: contract?.supplier?.bankAccount || "-" },
    { label: "备注", value: data?.remark || "-" },
  ];
  return <DetailGrid fields={fields} />;
}
