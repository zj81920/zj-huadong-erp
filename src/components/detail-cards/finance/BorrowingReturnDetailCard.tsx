import { DetailGrid } from '../DetailGrid'
import { formatAmount, formatDate } from '../format'

interface Props {
  data: any
}

export function BorrowingReturnDetailCard({ data }: Props) {
  const fields = [
    { label: "来源名称", value: data?.sourceName || "-" },
    { label: "来源类型", value: data?.sourceType === "other_borrowing" ? "其他借入款" : data?.sourceType === "shareholder_capital" ? "股东出资" : data?.sourceType || "-" },
    { label: "原始金额", value: data?.sourceAmount ? formatAmount(data.sourceAmount) : "-" },
    { label: "归还金额", value: data?.returnAmount ? formatAmount(data.returnAmount) : "-" },
    { label: "归还日期", value: data?.returnDate ? formatDate(data.returnDate) : "-" },
    { label: "创建时间", value: data?.createdAt ? formatDate(data.createdAt) : "-" },
    { label: "备注", value: data?.remark || "-" },
  ];
  return <DetailGrid fields={fields} />;
}
