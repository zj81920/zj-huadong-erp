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
  return (
    <>
      <DetailGrid fields={fields} />
      {data?.wbsItems && Array.isArray(data.wbsItems) && data.wbsItems.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">关联 WBS 任务明细</h4>
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left border">WBS 任务</th>
                <th className="p-2 text-center border">工作量</th>
                <th className="p-2 text-right border">单价(元)</th>
                <th className="p-2 text-right border">小计(元)</th>
              </tr>
            </thead>
            <tbody>
              {data.wbsItems.map((item: any) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2 border">{item.wbsNode?.name || "-"}</td>
                  <td className="p-2 text-center border">
                    {item.workload ? `${item.workload}${item.unit || ""}` : "-"}
                  </td>
                  <td className="p-2 text-right border">
                    {item.unitPrice ? Number(item.unitPrice).toLocaleString() : "-"}
                  </td>
                  <td className="p-2 text-right border font-semibold">
                    {item.subtotal ? Number(item.subtotal).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
