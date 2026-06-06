import { DetailGrid } from '../DetailGrid'
import { formatAmount, formatDate } from '../format'

interface Props {
  data: any
}

export function ExpenseContractDetailCard({ data }: Props) {
  const fields = [
    { label: "合同编号", value: data?.contractNo },
    { label: "合同类型", value: data?.contractType || "-" },
    { label: "供应商", value: data?.supplier?.name || "-" },
    { label: "合同金额", value: data?.totalAmount ? formatAmount(data.totalAmount) : "-" },
    { label: "签订日期", value: data?.signedDate ? formatDate(data.signedDate) : "-" },
    { label: "创建时间", value: data?.createdAt ? formatDate(data.createdAt) : "-" },
    { label: "关联项目", value: data?.project ? `${data.project.name} (${data.project.projectCode})` : (data?.projectSourceId || "公司级支出") },
    { label: "结算状态", value: data?.settlementStatus === "settled" ? "已结清" : data?.settlementStatus === "partial" ? "部分结算" : "未结算" },
  ];
  const items = (data?.items && data.items.length > 0) ? data.items : [];
  return (
    <div className="space-y-3">
      <DetailGrid fields={fields} />
      {data?.paymentTerms && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-1">付款条款</p>
          <p className="text-[13px] text-[#1C1917] whitespace-pre-wrap leading-relaxed bg-[#FAFAF9] p-2.5 rounded-xl">{data.paymentTerms}</p>
        </div>
      )}
      {items.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-2">合同明细（{items.length} 项）</p>
          <div className="overflow-x-auto max-h-[200px] overflow-y-auto border border-[#E7E5E4] rounded-xl">
            <table className="w-full text-[11px]">
              <thead className="bg-[#FAFAF9] sticky top-0">
                <tr>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">物资名称</th>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">规格型号</th>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">数量</th>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">单价</th>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">总价</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => (
                  <tr key={item.id} className="border-t border-[#F5F5F4]">
                    <td className="py-1 px-2 font-medium">{item.materialName}</td>
                    <td className="py-1 px-2 text-[#78716C]">{item.spec || "-"}</td>
                    <td className="py-1 px-2">{item.quantity ?? "-"}</td>
                    <td className="py-1 px-2">{item.unitPrice != null ? formatAmount(item.unitPrice) : "-"}</td>
                    <td className="py-1 px-2 font-medium">{item.totalPrice != null ? formatAmount(item.totalPrice) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
