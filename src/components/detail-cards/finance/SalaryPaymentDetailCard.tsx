import { DetailGrid } from '../DetailGrid'
import { formatAmount } from '../format'

interface Props {
  data: any
}

export function SalaryPaymentDetailCard({ data }: Props) {
  if (!data) return <p className="text-sm text-[#78716C]">无数据</p>;

  const items = data.items || [];

  return (
    <div className="space-y-3">
      <DetailGrid fields={[
        { label: "批次号", value: data.batchNo },
        { label: "工资周期", value: data.period },
        { label: "人数", value: `${data.employeeCount || 0} 人` },
        { label: "状态", value: data.status },
      ]} />

      <div className="bg-[#FAFAF9] rounded-xl p-3">
        <p className="text-[11px] font-semibold text-[#78716C] mb-2">工资汇总</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-[10px] text-[#78716C]">应发总额</p>
            <p className="text-[13px] font-bold text-[#1C1917]">{formatAmount(data.totalGrossSalary)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-[#78716C]">实发总额</p>
            <p className="text-[13px] font-bold text-[#78716C]">{formatAmount(data.totalNetSalary)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-[#78716C]">银行总支出</p>
            <p className="text-[13px] font-bold text-[#78716C]">{formatAmount(data.totalBankOutflow)}</p>
          </div>
        </div>
      </div>

      <div className="bg-[#FFF7ED] rounded-xl p-3">
        <p className="text-[11px] font-semibold text-[#78716C] mb-2">代扣代缴（个人）</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-[10px] text-[#78716C]">社保</p>
            <p className="text-[12px] font-medium text-[#1C1917]">{formatAmount(data.totalSocialInsurancePersonal)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-[#78716C]">公积金</p>
            <p className="text-[12px] font-medium text-[#1C1917]">{formatAmount(data.totalHousingFundPersonal)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-[#78716C]">个税</p>
            <p className="text-[12px] font-medium text-[#1C1917]">{formatAmount(data.totalIncomeTax)}</p>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-1">
            发放明细（共 {items.length} 人）
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#E7E5E4]">
                  <th className="text-left py-1 font-medium text-[#78716C]">员工</th>
                  <th className="text-right py-1 font-medium text-[#78716C]">应发</th>
                  <th className="text-right py-1 font-medium text-[#78716C]">扣款</th>
                  <th className="text-right py-1 font-medium text-[#78716C]">实发</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 5).map((item: any) => (
                  <tr key={item.id} className="border-b border-[#F5F5F4]">
                    <td className="py-1 font-medium text-[#1C1917]">{item.employee?.realName || "-"}</td>
                    <td className="py-1 text-right">{formatAmount(item.grossSalary)}</td>
                    <td className="py-1 text-right text-[#78716C]">{formatAmount(item.totalDeduction)}</td>
                    <td className="py-1 text-right font-medium">{formatAmount(item.netSalary)}</td>
                  </tr>
                ))}
                {items.length > 5 && (
                  <tr>
                    <td colSpan={4} className="py-1 text-center text-[#A8A29E]">
                      ... 还有 {items.length - 5} 人
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.remark && (
        <div>
          <p className="text-[11px] font-semibold text-[#78716C] mb-1">备注</p>
          <p className="text-sm text-[#1C1917] bg-[#FAFAF9] p-2 rounded-lg">{data.remark}</p>
        </div>
      )}
    </div>
  );
}
