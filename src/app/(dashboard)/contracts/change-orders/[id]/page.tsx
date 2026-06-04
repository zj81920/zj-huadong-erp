"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Building2, User } from "lucide-react";

export default function ChangeOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/change-orders/${id}`);
      const json = await res.json();
      setOrder(json.data);
    } catch (err) {
      console.error("获取变更单详情失败:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "¥0.00";
    return `¥${num.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("zh-CN");
  };

  const contractTypeLabel: Record<string, string> = {
    income_contract: "收入合同",
    expense_contract: "支出合同",
    inter_org_contract: "内部结算",
  };

  const statusColor: Record<string, string> = {
    "草稿": "ios-badge-gray",
    "待审批": "ios-badge-yellow",
    "已批准": "ios-badge-blue",
    "已生效": "ios-badge-green",
    "已驳回": "ios-badge-red",
  };

  if (loading) {
    return (
      <>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <button
              className="ios-btn ios-btn-ghost"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <div>
              <h1>变更单详情</h1>
              <p>加载中...</p>
            </div>
          </div>
        </div>
        <div className="bento-card-static">
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        </div>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <button
              className="ios-btn ios-btn-ghost"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <div>
              <h1>变更单详情</h1>
              <p>未找到该变更单</p>
            </div>
          </div>
        </div>
        <div className="bento-card-static">
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <FileText className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>未找到变更单信息</p>
          </div>
        </div>
      </>
    );
  }

  const diff = parseFloat(order.amountDifference || "0");

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="ios-btn ios-btn-ghost"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <div>
              <h1>{order.changeNo}</h1>
              <p>{contractTypeLabel[order.contractType] || order.contractType}</p>
            </div>
          </div>
          <span className={`ios-badge ${statusColor[order.status] || "ios-badge-gray"}`}>
            {order.status}
          </span>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="bento-card-static">
        <h3 className="text-[14px] font-bold text-[#1C1917] mb-4">基本信息</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">变更单号</p>
            <p className="text-[14px] font-semibold text-[#1C1917] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#78716C]" />
              {order.changeNo}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">合同类型</p>
            <p className="text-[14px] text-[#1C1917]">
              {contractTypeLabel[order.contractType] || order.contractType}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">状态</p>
            <p>
              <span className={`ios-badge ${statusColor[order.status] || "ios-badge-gray"}`}>
                {order.status}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">创建时间</p>
            <p className="text-[14px] text-[#1C1917]">
              {formatDate(order.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* 金额变更 */}
      <div className="bento-card-static">
        <h3 className="text-[14px] font-bold text-[#1C1917] mb-4">金额变更</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">变更前</p>
            <p className="text-[16px] font-bold text-[#1C1917]">
              {formatAmount(order.previousAmount || "0")}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">变更后</p>
            <p className="text-[16px] font-bold text-[#1C1917]">
              {formatAmount(order.newAmount || "0")}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">差额</p>
            <p
              className={`text-[16px] font-bold ${
                diff >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {diff >= 0 ? "+" : ""}
              {formatAmount(order.amountDifference || "0")}
            </p>
          </div>
        </div>
      </div>

      {/* 变更原因 */}
      <div className="bento-card-static">
        <h3 className="text-[14px] font-bold text-[#1C1917] mb-4">变更原因</h3>
        <p className="text-[14px] text-[#1C1917] whitespace-pre-wrap leading-relaxed bg-[#FAFAF9] p-3 rounded-xl">
          {order.changeReason}
        </p>
      </div>

      {/* 备注 */}
      {order.remark && (
        <div className="bento-card-static">
          <h3 className="text-[14px] font-bold text-[#1C1917] mb-4">备注</h3>
          <p className="text-[14px] text-[#1C1917] whitespace-pre-wrap leading-relaxed bg-[#FAFAF9] p-3 rounded-xl">
            {order.remark}
          </p>
        </div>
      )}

      {/* 关联合同 */}
      {order.relatedContract && (
        <div className="bento-card-static">
          <h3 className="text-[14px] font-bold text-[#1C1917] mb-4">关联合同</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <p className="text-[12px] text-[#78716C] mb-0.5">合同编号</p>
              <p className="text-[14px] font-semibold text-[#1C1917]">
                {order.relatedContract.contractNo || "-"}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-[#78716C] mb-0.5">
                {order.contractType === "income_contract"
                  ? "客户"
                  : order.contractType === "expense_contract"
                    ? "供应商"
                    : "收款方"}
              </p>
              <p className="text-[14px] text-[#1C1917] flex items-center gap-1.5">
                {order.contractType === "inter_org_contract" ? (
                  <>
                    <Building2 className="w-3.5 h-3.5 text-[#78716C]" />
                    {order.relatedContract.fromOrg?.name || "-"}
                  </>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5 text-[#78716C]" />
                    {order.relatedContract.customer?.name ||
                      order.relatedContract.supplier?.name ||
                      "-"}
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            className="mt-3 text-[13px] text-[#1C1917] hover:underline flex items-center gap-1"
            onClick={() => {
              const pathMap: Record<string, string> = {
                income_contract: `/contracts/income`,
                expense_contract: `/contracts/expense`,
                inter_org_contract: `/contracts/internal-settlement/${order.contractId}`,
              };
              router.push(pathMap[order.contractType] || "#");
            }}
          >
            查看原合同
          </button>
        </div>
      )}

      {/* 超收标记 */}
      {order.hasOverCollection && (
        <div className="bento-card-static bg-yellow-50">
          <h3 className="text-[14px] font-bold text-yellow-800 mb-4">
            ⚠️ 超收提醒
          </h3>
          <p className="text-[14px] text-yellow-800">
            已收金额超过变更后合同金额，超收：
            {formatAmount(order.overCollectionAmount || "0")}
          </p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="bento-card-static">
        <div className="flex items-center justify-end gap-3">
          {(order.status === "草稿" || order.status === "已驳回") && (
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() =>
                router.push(
                  `/contracts/change-orders/new?edit=${order.id}`
                )
              }
            >
              编辑
            </button>
          )}
        </div>
      </div>
    </>
  );
}
