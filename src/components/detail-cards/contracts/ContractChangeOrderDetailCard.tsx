import { DetailGrid } from '../DetailGrid'
import { formatAmount, formatDate } from '../format'

interface Props {
  data: any
}

export function ContractChangeOrderDetailCard({ data }: Props) {
  const contractTypeLabel: Record<string, string> = {
    income_contract: "收入合同",
    expense_contract: "支出合同",
    inter_org_contract: "内部结算",
  };
  const diff = parseFloat(data?.amountDifference || "0");
  const fields = [
    { label: "变更单号", value: data?.changeNo },
    { label: "合同类型", value: contractTypeLabel[data?.contractType] || data?.contractType || "-" },
    { label: "变更前金额", value: data?.previousAmount ? formatAmount(data.previousAmount) : "-" },
    { label: "变更后金额", value: data?.newAmount ? formatAmount(data.newAmount) : "-" },
    { label: "差额", value: `${diff >= 0 ? "+" : ""}${formatAmount(data?.amountDifference || "0")}` },
    { label: "创建时间", value: data?.createdAt ? formatDate(data.createdAt) : "-" },
  ];
  return (
    <div className="space-y-3">
      <DetailGrid fields={fields} />
      {data?.changeReason && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-1">变更原因</p>
          <p className="text-[13px] text-[#1C1917] whitespace-pre-wrap leading-relaxed bg-[#FAFAF9] p-2.5 rounded-xl">{data.changeReason}</p>
        </div>
      )}
      {data?.remark && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-1">备注</p>
          <p className="text-[13px] text-[#1C1917] whitespace-pre-wrap leading-relaxed bg-[#FAFAF9] p-2.5 rounded-xl">{data.remark}</p>
        </div>
      )}
    </div>
  );
}
