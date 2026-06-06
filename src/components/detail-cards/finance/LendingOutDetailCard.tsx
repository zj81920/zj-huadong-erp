import { DetailGrid } from '../DetailGrid'
import { formatAmount, formatDate } from '../format'

interface Props {
  data: any
}

export function LendingOutDetailCard({ data }: Props) {
  const fields = [
    { label: "借款人", value: data?.borrowerName },
    { label: "借款类型", value: data?.lendingType || "-" },
    { label: "借出金额", value: data?.amount ? formatAmount(data.amount) : "-" },
    { label: "已收回", value: data?.returnedAmount ? formatAmount(data.returnedAmount) : "-" },
    { label: "未收回", value: data?.remainingAmount ? formatAmount(data.remainingAmount) : "-" },
    { label: "借出日期", value: data?.lendingDate ? formatDate(data.lendingDate) : "-" },
    { label: "预计归还日期", value: data?.expectedReturnDate ? formatDate(data.expectedReturnDate) : "-" },
  ];
  const returns = data?.returns || [];
  return (
    <div className="space-y-3">
      <DetailGrid fields={fields} />
      {data?.description && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-1">说明</p>
          <p className="text-[13px] text-[#1C1917] whitespace-pre-wrap leading-relaxed bg-[#FAFAF9] p-2.5 rounded-xl">{data.description}</p>
        </div>
      )}
      {returns.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-2">归还记录（{returns.length} 笔）</p>
          <div className="space-y-1.5">
            {returns.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-2 bg-[#FAFAF9] rounded-xl">
                <div>
                  <p className="text-[12px] font-medium text-[#1C1917]">{formatAmount(r.amount || r.returnAmount)}</p>
                  <p className="text-[11px] text-[#78716C]">{formatDate(r.returnDate)}</p>
                </div>
                {r.remark && <p className="text-[11px] text-[#78716C]">{r.remark}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
