import { DetailGrid } from '../DetailGrid'
import { formatAmount, formatDate } from '../format'

interface Props {
  data: any
}

export function IncomeContractDetailCard({ data }: Props) {
  const fields = [
    { label: "合同编号", value: data?.contractNo },
    { label: "客户名称", value: data?.customer?.name },
    { label: "合同金额", value: data?.totalAmount ? formatAmount(data.totalAmount) : "-" },
    { label: "合同税率", value: data?.taxRate || "-" },
    { label: "计价方式", value: data?.pricingMethod || "-" },
    { label: "项目", value: data?.projectSourceId || "未关联项目" },
    { label: "签订日期", value: data?.signedDate ? formatDate(data.signedDate) : "-" },
    { label: "创建时间", value: data?.createdAt ? formatDate(data.createdAt) : "-" },
    { label: "联系人", value: data?.customer?.contactPerson || "-" },
    { label: "联系电话", value: data?.customer?.phone || "-" },
  ];
  const splitStages = (data?.splitStages && Array.isArray(data.splitStages) && data.splitStages.length > 0) ? data.splitStages : [];
  return (
    <div className="space-y-3">
      <DetailGrid fields={fields} />
      {data?.contractSummary && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-1">合同概要</p>
          <p className="text-[13px] text-[#1C1917] whitespace-pre-wrap leading-relaxed bg-[#FAFAF9] p-2.5 rounded-xl">{data.contractSummary}</p>
        </div>
      )}
      {data?.paymentTerms && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-1">付款方式</p>
          <p className="text-[13px] text-[#1C1917] whitespace-pre-wrap leading-relaxed bg-[#FAFAF9] p-2.5 rounded-xl">{data.paymentTerms}</p>
        </div>
      )}
      {splitStages.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-2">分期付款（{splitStages.length}期）</p>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[#E7E5E4]">
                <th className="text-left py-1 font-medium text-[#78716C]">阶段</th>
                <th className="text-left py-1 font-medium text-[#78716C]">名称</th>
                <th className="text-right py-1 font-medium text-[#78716C]">金额</th>
              </tr>
            </thead>
            <tbody>
              {splitStages.map((stage: any, index: number) => (
                <tr key={index} className="border-b border-[#F5F5F4]">
                  <td className="py-1 text-[#78716C]">P{index + 1}</td>
                  <td className="py-1">{stage.name || "-"}</td>
                  <td className="py-1 text-right font-medium">{formatAmount(stage.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
