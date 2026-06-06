import { DetailGrid } from '../DetailGrid'
import { formatAmount, formatDate } from '../format'

interface Props {
  data: any
}

export function NonContractExpenseDetailCard({ data }: Props) {
  const fields = [
    { label: "支出金额", value: data?.amount ? formatAmount(data.amount) : "-" },
    { label: "交易日期", value: data?.transactionDate ? formatDate(data.transactionDate) : "-" },
    { label: "关联项目", value: data?.project?.name || data?.projectSourceId || "-" },
    { label: "对方单位", value: data?.counterparty || "-" },
    { label: "开户行", value: data?.counterpartyBankName || "-" },
    { label: "银行账号", value: data?.counterpartyBankAccount || "-" },
  ];
  return (
    <div className="space-y-3">
      <DetailGrid fields={fields} />
      {data?.description && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-1">说明</p>
          <p className="text-[13px] text-[#1C1917] whitespace-pre-wrap leading-relaxed bg-[#FAFAF9] p-2.5 rounded-xl">{data.description}</p>
        </div>
      )}
    </div>
  );
}
