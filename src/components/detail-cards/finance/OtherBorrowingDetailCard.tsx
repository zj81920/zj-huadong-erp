import { DetailGrid } from '../DetailGrid'
import { formatAmount, formatDate } from '../format'

interface Props {
  data: any
}

export function OtherBorrowingDetailCard({ data }: Props) {
  const fields = [
    { label: "出借方", value: data?.lenderName || "-" },
    { label: "借入金额", value: data?.amount ? formatAmount(data.amount) : "-" },
    { label: "已归还", value: data?.returnedAmount ? formatAmount(data.returnedAmount) : "-" },
    { label: "剩余金额", value: data?.remainingAmount ? formatAmount(data.remainingAmount) : "-" },
    { label: "借入日期", value: data?.borrowingDate ? formatDate(data.borrowingDate) : "-" },
    { label: "预计归还", value: data?.expectedReturnDate ? formatDate(data.expectedReturnDate) : "-" },
    { label: "备注", value: data?.description || data?.remark || "-" },
  ];
  return <DetailGrid fields={fields} />;
}
