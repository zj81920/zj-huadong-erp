import { DetailGrid } from '../DetailGrid'
import { formatAmount, formatDate } from '../format'

interface Props {
  data: any
}

export function InterOrgContractDetailCard({ data }: Props) {
  const fields = [
    { label: "合同编号", value: data?.contractNo },
    { label: "合同名称", value: data?.contractName },
    { label: "收款方", value: data?.fromOrg?.name || "-" },
    { label: "付款方", value: data?.toOrg?.name || "-" },
    { label: "主合同金额", value: data?.mainContractAmount ? formatAmount(data.mainContractAmount) : "-" },
    { label: "管理费", value: data?.managementFee ? formatAmount(data.managementFee) : "-" },
    { label: "税费承担", value: data?.taxBurden ? formatAmount(data.taxBurden) : "-" },
    { label: "其他费用", value: data?.otherFee ? `${formatAmount(data.otherFee)}${data?.otherFeeNote ? ` (${data.otherFeeNote})` : ""}` : "-" },
    { label: "结算合同额", value: data?.settlementAmount ? formatAmount(data.settlementAmount) : "-" },
    { label: "关联主合同", value: data?.relatedContract?.contractNo || "-" },
    { label: "客户", value: data?.relatedContract?.customer?.name || "-" },
    { label: "创建时间", value: data?.createdAt ? formatDate(data.createdAt) : "-" },
  ];
  return (
    <div className="space-y-3">
      <DetailGrid fields={fields} />
      {data?.remark && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-1">备注</p>
          <p className="text-[13px] text-[#1C1917] whitespace-pre-wrap leading-relaxed bg-[#FAFAF9] p-2.5 rounded-xl">{data.remark}</p>
        </div>
      )}
    </div>
  );
}
