import { DetailGrid } from '../DetailGrid'
import { formatDate } from '../format'

interface Props {
  data: any
}

export function PurchaseRequestDetailCard({ data }: Props) {
  const fields = [
    { label: "计划单号", value: data?.requestNo },
    { label: "项目名称", value: data?.project?.name },
    { label: "项目源ID", value: data?.projectSourceId },
    { label: "需求日期", value: data?.requiredDate ? formatDate(data.requiredDate) : "-" },
    { label: "物资数量", value: data?.items?.length ? `${data.items.length} 项` : "0 项" },
    { label: "状态", value: data?.status },
  ];
  const items = data?.items || [];
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
                    <td className="py-1 px-2">{item.quantity || "-"}</td>
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
