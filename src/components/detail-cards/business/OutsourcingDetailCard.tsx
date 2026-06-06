import { DetailGrid } from '../DetailGrid'
import { formatAmount, formatDate } from '../format'

interface Props {
  data: any
}

export function OutsourcingDetailCard({ data }: Props) {
  const fields = [
    { label: "项目名称", value: data?.project?.name },
    { label: "类型", value: data?.type === "to_company" ? "对公司" : data?.type === "to_individual" ? "对个人" : data?.type },
    { label: "外包对象", value: data?.targetName },
    { label: "供应商性质", value: data?.supplier?.supplierType },
    { label: "任务描述", value: data?.taskDescription },
    { label: "工作量", value: data?.workload },
    { label: "金额", value: data?.amount ? formatAmount(data.amount) : "-" },
    { label: "交付截止日", value: data?.deliveryDeadline ? formatDate(data.deliveryDeadline) : "-" },
    { label: "验收状态", value: data?.acceptanceStatus },
    { label: "创建时间", value: data?.createdAt ? formatDate(data.createdAt) : "-" },
  ];
  return <DetailGrid fields={fields} />;
}
