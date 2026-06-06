import { DetailGrid } from '../DetailGrid'

interface Props {
  data: any
}

export function QuotationDetailCard({ data }: Props) {
  const fields = [
    { label: "客户", value: data?.customer?.name },
    { label: "预估成本", value: data?.estimatedCost ? `¥${Number(data.estimatedCost).toLocaleString()}` : "-" },
    { label: "总金额", value: data?.totalAmount ? `¥${Number(data.totalAmount).toLocaleString()}` : "-" },
    { label: "利润率", value: data?.profitMargin ? `${data.profitMargin}%` : "-" },
    { label: "状态", value: data?.status },
  ];
  return <DetailGrid fields={fields} />;
}
