"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Eye, Pencil, Trash2, FileText, ChevronRight } from "lucide-react";

interface ChangeOrder {
  id: string;
  changeNo: string;
  contractType: string;
  contractId: string;
  changeReason: string;
  previousAmount: string;
  newAmount: string;
  amountDifference: string;
  status: string;
  createdAt: string;
}

export default function ChangeOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

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

  const fetchOrders = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterType) params.set("contractType", filterType);

    const res = await fetch(`/api/change-orders?${params}`);
    const json = await res.json();
    setOrders(json.data || []);
    setLoading(false);
  }, [filterStatus, filterType]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除此变更单？")) return;
    await fetch(`/api/change-orders/${id}`, { method: "DELETE" });
    fetchOrders();
  };

  const handleSubmitApproval = async (order: ChangeOrder) => {
    const res = await fetch("/api/approval-instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessType: "contract_change_order",
        businessId: order.id,
        flowLevel: "common",
      }),
    });
    if (res.ok) {
      fetchOrders();
    } else {
      const json = await res.json();
      alert(json.error || "提交审批失败");
    }
  };

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "0";
    return num.toLocaleString("zh-CN");
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>合同变更</h1>
            <p>管理合同变更单，变更合同金额和其他信息</p>
          </div>
          <button
            className="ios-btn ios-btn-primary"
            onClick={() => router.push("/contracts/change-orders/new")}
          >
            <Plus className="w-4 h-4" />
            新建变更单
          </button>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索变更单号..."
              value=""
              readOnly
            />
          </div>

          <select
            className="ios-select w-[160px]"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">全部类型</option>
            {Object.entries(contractTypeLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            className="ios-select w-[140px]"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">全部状态</option>
            {["草稿", "待审批", "已批准", "已生效", "已驳回"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <FileText className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>暂无变更单，点击右上角新建</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>变更单号</th>
                  <th>合同类型</th>
                  <th>原金额</th>
                  <th>新金额</th>
                  <th>差额</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-[#1C1917]" />
                        </div>
                        <span className="font-semibold">{o.changeNo}</span>
                      </div>
                    </td>
                    <td>{contractTypeLabel[o.contractType] || o.contractType}</td>
                    <td className="font-semibold">{formatAmount(o.previousAmount || "0")}</td>
                    <td className="font-semibold">{formatAmount(o.newAmount || "0")}</td>
                    <td className={`font-semibold ${parseFloat(o.amountDifference) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {parseFloat(o.amountDifference) >= 0 ? "+" : ""}{formatAmount(o.amountDifference || "0")}
                    </td>
                    <td>
                      <span className={`ios-badge ${statusColor[o.status] || "ios-badge-gray"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => router.push(`/contracts/change-orders/${o.id}`)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          查看
                        </button>
                        {(o.status === "草稿" || o.status === "已驳回") && (
                          <>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => router.push(`/contracts/change-orders/new?edit=${o.id}`)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              编辑
                            </button>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                              onClick={() => handleDelete(o.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              删除
                            </button>
                          </>
                        )}
                        {o.status === "草稿" && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                            onClick={() => handleSubmitApproval(o)}
                          >
                            提交审批
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
