import { DetailGrid } from '../DetailGrid'
import { formatDate } from '../format'

interface Props {
  data: any
}

export function InquiryDetailCard({ data }: Props) {
  const pr = data?.purchaseRequest;
  const fields = [
    { label: "需求单号", value: pr?.requestNo || "-" },
    { label: "项目名称", value: data?.projectCode ? `${data.projectCode} - ${data.projectName}` : (data?.projectName || data?.projectSourceId || "-") },
    { label: "物资数量", value: pr?.items?.length ? `${pr.items.length} 项` : "0 项" },
    { label: "询价日期", value: data?.inquiryDate ? formatDate(data.inquiryDate) : "-" },
    { label: "要求交货日期", value: data?.closingDate ? formatDate(data.closingDate) : "-" },
    { label: "询价模式", value: data?.inquiryMode === "online" ? "线上询价" : "线下询价" },
    { label: "线上截止时间", value: data?.onlineDeadline ? new Date(data.onlineDeadline).toLocaleString("zh-CN") : "-" },
  ];
  const items = pr?.items || [];
  return (
    <div className="space-y-3">
      <DetailGrid fields={fields} />
      {items.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-2">物资明细（{items.length} 项）</p>
          <div className="overflow-x-auto max-h-[200px] overflow-y-auto border border-[#E7E5E4] rounded-xl">
            <table className="w-full text-[11px]">
              <thead className="bg-[#FAFAF9] sticky top-0">
                <tr>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">物资名称</th>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">规格</th>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">数量</th>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">单位</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => (
                  <tr key={item.id} className="border-t border-[#F5F5F4]">
                    <td className="py-1 px-2 font-medium">{item.materialName}</td>
                    <td className="py-1 px-2 text-[#78716C]">{item.spec || "-"}</td>
                    <td className="py-1 px-2">{item.quantity ?? "-"}</td>
                    <td className="py-1 px-2">{item.unit || "-"}</td>
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
