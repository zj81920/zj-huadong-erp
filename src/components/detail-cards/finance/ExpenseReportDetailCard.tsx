import { DetailGrid } from '../DetailGrid'
import { formatAmount, formatDate } from '../format'

interface Props {
  data: any
}

export function ExpenseReportDetailCard({ data }: Props) {
  const fields = [
    { label: "申请人", value: data?.applicant?.realName || "-" },
    { label: "费用类型", value: data?.expenseType || "-" },
    { label: "报销总金额", value: data?.amount ? formatAmount(data.amount) : "-" },
    { label: "借款抵扣", value: data?.loanOffsetAmount > 0 ? formatAmount(data.loanOffsetAmount) : "-" },
    { label: "创建时间", value: data?.createdAt ? formatDate(data.createdAt) : "-" },
    {
      label: "附件",
      value: data?.attachmentUrl ? (
        <a href={data.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline text-[13px] break-all">
          {decodeURIComponent(data.attachmentUrl.split('/').pop() || '查看附件')}
        </a>
      ) : null,
    },
  ];
  const items = data?.items || [];
  return (
    <div className="space-y-3">
      <DetailGrid fields={fields} />
      {items.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-2">报销明细（{items.length} 项）</p>
          <div className="overflow-x-auto max-h-[200px] overflow-y-auto border border-[#E7E5E4] rounded-xl">
            <table className="w-full text-[11px]">
              <thead className="bg-[#FAFAF9] sticky top-0">
                <tr>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">费用说明</th>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">关联项目</th>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">金额</th>
                  <th className="py-1.5 px-2 text-left font-medium text-[#78716C]">费用类型</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any) => (
                  <tr key={it.id} className="border-t border-[#F5F5F4]">
                    <td className="py-1 px-2">{it.description || "-"}</td>
                    <td className="py-1 px-2">{it.project?.name || it.projectSourceId || "-"}</td>
                    <td className="py-1 px-2 font-medium">{it.amount ? formatAmount(it.amount) : "-"}</td>
                    <td className="py-1 px-2">{it.expenseType || "-"}</td>
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
