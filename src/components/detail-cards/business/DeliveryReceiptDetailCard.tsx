import { DetailGrid } from '../DetailGrid'
import { formatAmount, formatDate } from '../format'

interface Props {
  data: any
}

export function DeliveryReceiptDetailCard({ data }: Props) {
  const fields = [
    { label: "支出合同编号", value: data?.expenseContract?.contractNo || "-" },
    { label: "供应商", value: data?.expenseContract?.supplier?.name || "-" },
    { label: "合同金额", value: data?.expenseContract?.totalAmount ? formatAmount(data.expenseContract.totalAmount) : "-" },
    { label: "合同状态", value: data?.expenseContract?.status || "-" },
    { label: "到货日期", value: data?.deliveryDate ? formatDate(data.deliveryDate) : "-" },
    { label: "到货金额", value: data?.deliveryAmount ? formatAmount(data.deliveryAmount) : "-" },
    { label: "实收数量", value: data?.items?.length ? data.items.reduce((sum: number, item: any) => sum + (item.receivedQuantity || 0), 0) : "-" },
    { label: "检验结果", value: data?.inspectionResult || "-" },
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
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">合同数量</th>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">实收数量</th>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">检验结果</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, idx: number) => (
                  <tr key={idx} className="border-t border-[#F5F5F4]">
                    <td className="py-1 px-2 font-medium">{item.materialName}</td>
                    <td className="py-1 px-2 text-[#78716C]">{item.spec || "-"}</td>
                    <td className="py-1 px-2">{item.orderedQuantity ?? "-"}</td>
                    <td className="py-1 px-2">{item.receivedQuantity ?? "-"}</td>
                    <td className="py-1 px-2">{item.inspectionResult || "-"}</td>
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
