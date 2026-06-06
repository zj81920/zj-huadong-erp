"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Eye,
  Send,
  X,
  MessageSquare,
} from "lucide-react";
import { ApprovalTimeline, ApprovalActionButton, ApprovalInfoPanel } from "@/components/ApprovalComponents";
import Modal from "@/components/Modal";
import { DETAIL_CARD_MAP } from "@/components/detail-cards";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";
import { getRowStatusClass } from "@/lib/status-colors";

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  quotation: "商务报价",
  supplier: "供应商审批",
  outsourcing: "外包任务",
  purchase_request: "采购需求",
  delivery_receipt: "到货验收",
  income_contract: "收入合同",
  expense_contract: "支出合同",
  non_contract_expense: "其他支付",
  non_contract_income: "其他收入",
  payment_application: "合同支付",
  expense_report: "费用报销",
  supplier_change: "供应商变更",
  other_borrowing: "其他借入款",
  lending_out: "借出款",
  salary_payment: "工资发放",
  borrowing_return_application: "借入资金归还",
  inquiries: "采购单",
  inter_org_contract: "内部结算合同",
  contract_change_order: "合同变更",
};

const BUSINESS_TYPE_API_MAP: Record<string, string> = {
  quotation: "/api/quotations",
  supplier: "/api/suppliers",
  outsourcing: "/api/projects/outsourcing",
  purchase_request: "/api/purchase-requests",
  delivery_receipt: "/api/delivery-receipts",
  income_contract: "/api/income-contracts",
  expense_contract: "/api/expense-contracts",
  non_contract_expense: "/api/non-contract-expenses",
  payment_application: "/api/payment-applications",
  expense_report: "/api/expense-reports",
  other_borrowing: "/api/other-borrowings",
  lending_out: "/api/lending-outs",
  salary_payment: "/api/salary-batches",
  borrowing_return_application: "/api/borrowing-return-applications",
  inquiries: "/api/inquiries",
  inter_org_contract: "/api/inter-org-contracts",
  contract_change_order: "/api/change-orders",
  supplier_change: "/api/supplier-changes",
};

interface PendingApproval {
  id: string;
  businessType: string;
  businessId: string;
  flowLevel: string;
  currentNode: number;
  nodeName: string;
  nodeType: string;
  createdAt: string;
  initiatorName: string;
  businessTitle?: string;
}

/** 根据等待时间计算优先级标签 */
function getPriorityInfo(createdAt: string): { label: string; className: string } {
  const diff = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours >= 48) {
    return { label: "紧急", className: "ios-badge ios-badge-red" };
  }
  if (hours >= 24) {
    return { label: "重要", className: "ios-badge ios-badge-yellow" };
  }
  return { label: "普通", className: "ios-badge ios-badge-gray" };
}

interface ApprovalInstanceItem {
  id: string;
  businessType: string;
  businessId: string;
  status: string;
  currentNode: number;
  flowLevel: string;
  createdAt: string;
  businessTitle?: string;
}

interface ApprovalDetail {
  id: string;
  businessType: string;
  businessId: string;
  status: string;
  currentNode: number;
  createdAt: string;
  actions: any[];
  flowNodes: any[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${min}`;
}

function getTimeAgo(dateStr: string) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return formatDate(dateStr);
}

function BusinessDetailPanel({ businessType, data, loading }: { businessType: string; data: any; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-3 rounded-xl bg-[#FAFAF9]">
            <div className="h-3 w-16 bg-[#E7E5E4] rounded mb-2" />
            <div className="h-4 w-24 bg-[#E7E5E4] rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-3 rounded-xl bg-[#FFF3CD]">
        <p className="text-[13px] text-[#856404]">无法加载业务详情，但不影响审批操作</p>
      </div>
    );
  }

  const CardComponent = DETAIL_CARD_MAP[businessType];
  if (!CardComponent) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-[#FAFAF9]">
          <p className="text-[12px] text-[#78716C] mb-1">业务类型</p>
          <p className="text-[14px] font-semibold">{BUSINESS_TYPE_LABELS[businessType] || businessType}</p>
        </div>
      </div>
    );
  }

  return <CardComponent data={data} />;
}

export default function ApprovalsPage() {
  const router = useRouter();
  const { page, pageSize, setPage, setPageSize, pagination, setPagination } = usePagination({});
  const [pendingList, setPendingList] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "processed" | "initiated">("pending");
  const [processedList, setProcessedList] = useState<ApprovalInstanceItem[]>([]);
  const [initiatedList, setInitiatedList] = useState<ApprovalInstanceItem[]>([]);
  const [processedLoading, setProcessedLoading] = useState(false);
  const [initiatedLoading, setInitiatedLoading] = useState(false);

  const [selectedApproval, setSelectedApproval] = useState<(PendingApproval & { status?: string }) | null>(null);
  const [approvalDetail, setApprovalDetail] = useState<ApprovalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [businessDetail, setBusinessDetail] = useState<any>(null);
  const [businessDetailLoading, setBusinessDetailLoading] = useState(false);

  const fetchPending = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/approval-instances?type=pending");
      const json = await res.json();
      if (res.ok) {
        const list = json.data || [];
        setPendingList(list);
        return list;
      } else {
        setError(json.error || "获取待审批列表失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
    return [];
  };

  const fetchProcessed = async () => {
    setProcessedLoading(true);
    try {
      const res = await fetch("/api/approval-instances?type=processed");
      if (res.ok) {
        const json = await res.json();
        setProcessedList(json.data || []);
      }
    } catch {} finally { setProcessedLoading(false); }
  };

  const fetchInitiated = async () => {
    setInitiatedLoading(true);
    try {
      const res = await fetch("/api/approval-instances?type=initiated");
      if (res.ok) {
        const json = await res.json();
        setInitiatedList(json.data || []);
      }
    } catch {} finally { setInitiatedLoading(false); }
  };

  useEffect(() => {
    if (activeTab === "processed" && processedList.length === 0) fetchProcessed();
    if (activeTab === "initiated" && initiatedList.length === 0) fetchInitiated();
  }, [activeTab]);

  useEffect(() => {
    fetchPending();
  }, [page, pageSize]);

  // 已处理列表分组去重：同一 businessType+businessId 只显示最新实例
  const groupedProcessedList = useMemo(() => {
    const latestMap = new Map<string, ApprovalInstanceItem>();
    for (const item of processedList) {
      const key = `${item.businessType}:${item.businessId}`;
      if (!latestMap.has(key)) {
        latestMap.set(key, item);
      }
    }
    return Array.from(latestMap.values());
  }, [processedList]);

  // 重新提交：跳转到对应业务页面
  const handleResubmit = (item: { businessType: string }) => {
    const hrefMap: Record<string, string> = {
      supplier: "/business/suppliers",
      supplier_change: "/business/suppliers",
      outsourcing: "/projects/outsourcing",
      purchase_request: "/procurement/requests",
      delivery_receipt: "/procurement/deliveries",
      income_contract: "/contracts/income",
      expense_contract: "/contracts/expense",
      non_contract_expense: "/finance/expense",
      non_contract_income: "/contracts/non-contract",
      payment_application: "/finance/expense",
      expense_report: "/finance/expense",
      lending_out: "/finance/expense",
      salary_payment: "/finance/expense",
      borrowing_return_application: "/finance/expense",
      contract_change_order: "/contracts/change-orders",
      inter_org_contract: "/contracts/internal-settlement",
      inquiries: "/procurement/inquiries",
      quotation: "/business/quotations",
    };
    router.push(hrefMap[item.businessType] || "/");
  };

  const openApprovalDetail = async (item: PendingApproval) => {
    setSelectedApproval(item);
    setApprovalDetail(null);
    setBusinessDetail(null);
    setDetailLoading(true);
    setBusinessDetailLoading(true);
    try {
      const [instanceRes, detailRes] = await Promise.all([
        fetch(`/api/approval-instances/${item.id}`),
        BUSINESS_TYPE_API_MAP[item.businessType]
          ? fetch(`${BUSINESS_TYPE_API_MAP[item.businessType]}/${item.businessId}`)
          : Promise.resolve(null),
      ]);

      const instanceJson = await instanceRes.json();
      if (instanceRes.ok && instanceJson.data) {
        setApprovalDetail(instanceJson.data);
      }

      if (detailRes && detailRes.ok) {
        const detailJson = await detailRes.json();
        if (detailJson.data) {
          setBusinessDetail(detailJson.data);
        }
      }
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
      setBusinessDetailLoading(false);
    }
  };

  const openProcessedDetail = async (item: ApprovalInstanceItem) => {
    const pseudoItem: PendingApproval = {
      id: item.id,
      businessType: item.businessType,
      businessId: item.businessId,
      flowLevel: item.flowLevel || "common",
      currentNode: item.currentNode,
      nodeName: "",
      nodeType: "",
      createdAt: item.createdAt,
      initiatorName: "",
    };
    setSelectedApproval(pseudoItem);
    setApprovalDetail(null);
    setBusinessDetail(null);
    setDetailLoading(true);
    setBusinessDetailLoading(true);
    try {
      const [instanceRes, detailRes] = await Promise.all([
        fetch(`/api/approval-instances/${item.id}`),
        BUSINESS_TYPE_API_MAP[item.businessType]
          ? fetch(`${BUSINESS_TYPE_API_MAP[item.businessType]}/${item.businessId}`)
          : Promise.resolve(null),
      ]);
      const instanceJson = await instanceRes.json();
      if (instanceRes.ok && instanceJson.data) setApprovalDetail(instanceJson.data);
      if (detailRes && detailRes.ok) {
        const detailJson = await detailRes.json();
        if (detailJson.data) setBusinessDetail(detailJson.data);
      }
    } catch {} finally {
      setDetailLoading(false);
      setBusinessDetailLoading(false);
    }
  };

  const handleStatusChange = async (_newStatus: string, _instanceId: string | null) => {
    const refreshedList = await fetchPending();
    if (selectedApproval && _instanceId) {
      const refreshedItem = refreshedList.find((p: PendingApproval) => p.id === _instanceId);
      if (refreshedItem) {
        await openApprovalDetail(refreshedItem);
      } else {
        setSelectedApproval(null);
        setApprovalDetail(null);
      }
    } else if (selectedApproval) {
      if (refreshedList.length === 0) {
        setSelectedApproval(null);
        setApprovalDetail(null);
      } else {
        await openApprovalDetail(selectedApproval);
      }
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>{activeTab === "pending" ? "待审批" : activeTab === "processed" ? "已处理" : "已发起"}</h1>
        <p>{activeTab === "pending" ? "您需要处理的审批事项" : activeTab === "processed" ? "您已处理过的审批记录" : "您发起的审批流程"}</p>
      </div>

      <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
        <button onClick={() => setActiveTab("pending")} className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${activeTab === "pending" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <Clock className="w-4 h-4 inline mr-1.5 -mt-0.5" />待处理
          {pendingList.length > 0 && <span className="ml-1.5 bg-blue-100 text-blue-600 text-[11px] px-1.5 py-0.5 rounded-full">{pendingList.length}</span>}
        </button>
        <button onClick={() => setActiveTab("processed")} className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${activeTab === "processed" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <CheckCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />已处理
        </button>
        <button onClick={() => setActiveTab("initiated")} className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${activeTab === "initiated" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <Send className="w-4 h-4 inline mr-1.5 -mt-0.5" />已发起
        </button>
      </div>

      {activeTab === "pending" && (
      <div className="bento-card-static">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#78716C]" />
            <h3 className="text-[15px] font-bold text-[#1C1917]">待处理审批</h3>
            {!loading && (
              <span className="text-[13px] font-semibold text-[#78716C] bg-[#78716C]/10 px-2 py-0.5 rounded-full">
                {pendingList.length} 项
              </span>
            )}
          </div>
          <button
            className="ios-btn ios-btn-ghost ios-btn-sm"
            onClick={fetchPending}
            disabled={loading}
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-2 border-[#78716C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-full bg-[#78716C]/10 flex items-center justify-center mb-3">
              <XCircle className="w-7 h-7 text-[#78716C]" />
            </div>
            <p className="text-[14px] font-medium text-[#1C1917]">加载失败</p>
            <p className="text-[12px] text-[#78716C] mt-1 mb-4">{error}</p>
            <button className="ios-btn ios-btn-primary ios-btn-sm" onClick={fetchPending}>
              重新加载
            </button>
          </div>
        ) : pendingList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-[#78716C]" />
            </div>
            <p className="text-[14px] font-medium text-[#1C1917] mt-3">暂无待审批事项</p>
            <p className="text-[12px] text-[#78716C] mt-1">所有审批流程均已处理完毕</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>业务类型</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {pendingList.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#78716C]/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-[#78716C]" />
                        </div>
                        <span className="font-semibold">
                          {BUSINESS_TYPE_LABELS[item.businessType] || item.businessType}
                          {item.businessTitle ? `：${item.businessTitle}` : ""}
                        </span>
                      </div>
                    </td>
                    <td>
                      {item.nodeType === "resubmit" ? (
                        <button
                          className="ios-btn !bg-[#F59E0B] !text-white ios-btn-sm"
                          onClick={() => handleResubmit(item)}
                        >
                          <Send className="w-3.5 h-3.5" />
                          重新提交
                        </button>
                      ) : (
                        <button
                          className="ios-btn !bg-[#2563EB] !text-white ios-btn-sm"
                          onClick={() => openApprovalDetail(item)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          处理审批
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar pagination={pagination} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </div>
        )}
      </div>
      )}
      {activeTab === "processed" && (
        <div className="bento-card-static">
          {processedLoading ? (
            <div className="flex items-center justify-center py-16"><div className="w-10 h-10 border-2 border-[#78716C] border-t-transparent rounded-full animate-spin" /></div>
          ) : processedList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CheckCircle className="w-8 h-8 text-[#78716C] mb-3" />
              <p className="text-[14px] font-medium text-[#1C1917]">暂无已处理事项</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead><tr><th>业务类型</th><th>状态</th><th>提交时间</th><th>操作</th></tr></thead>
                <tbody>
                  {groupedProcessedList.map((item) => (
                    <tr key={item.id}>
                      <td><span className="font-semibold">{BUSINESS_TYPE_LABELS[item.businessType] || item.businessType}{item.businessTitle ? `：${item.businessTitle}` : ""}</span></td>
                      <td><span className="ios-badge ios-badge-green">{item.status}</span></td>
                      <td className="text-[#78716C] text-[13px] whitespace-nowrap">{formatDate(item.createdAt)}</td>
                      <td>
                        <button onClick={() => openProcessedDetail(item)} className="text-[13px] font-medium text-[#1C1917] bg-[#FAFAF9] hover:bg-[#F5F5F4] px-3 py-1.5 rounded-lg border border-[#E7E5E4] transition-colors">
                          <Eye className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationBar pagination={pagination} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          )}
        </div>
      )}
      {activeTab === "initiated" && (
        <div className="bento-card-static">
          {initiatedLoading ? (
            <div className="flex items-center justify-center py-16"><div className="w-10 h-10 border-2 border-[#78716C] border-t-transparent rounded-full animate-spin" /></div>
          ) : initiatedList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Send className="w-8 h-8 text-[#78716C] mb-3" />
              <p className="text-[14px] font-medium text-[#1C1917]">暂无已发起事项</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead><tr>
                  <th>摘要</th>
                  <th>状态</th>
                  <th>优先级</th>
                  <th>提交时间</th>
                  <th>操作</th>
                </tr></thead>
                <tbody>
                  {initiatedList.map((item) => {
                    const priority = getPriorityInfo(item.createdAt);
                    return (
                    <tr key={item.id} className={getRowStatusClass(item.status)}>
                      <td>
                        <span className="font-semibold">
                          {BUSINESS_TYPE_LABELS[item.businessType] || item.businessType}
                          {item.businessTitle ? `：${item.businessTitle}` : ""}
                        </span>
                      </td>
                      <td><span className={`ios-badge ${item.status === "审批中" ? "ios-badge-blue" : item.status === "已批准" ? "ios-badge-green" : "ios-badge-red"}`}>{item.status}</span></td>
                      <td><span className={priority.className}>{priority.label}</span></td>
                      <td className="text-[#78716C] text-[13px] whitespace-nowrap">{formatDate(item.createdAt)}</td>
                      <td>
                        {item.status === "已驳回" ? (
                          <button onClick={() => handleResubmit(item)} className="text-[13px] font-medium text-[#2563EB] hover:text-blue-700 transition-colors">
                            <Send className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />重新提交
                          </button>
                        ) : (
                          <button onClick={() => {
                            const pseudoItem: PendingApproval & { status?: string } = {
                              id: item.id,
                              businessType: item.businessType,
                              businessId: item.businessId,
                              flowLevel: item.flowLevel,
                              currentNode: item.currentNode,
                              nodeName: "",
                              nodeType: "approval",
                              createdAt: item.createdAt,
                              initiatorName: "",
                              businessTitle: item.businessTitle,
                              status: item.status,
                            };
                            setSelectedApproval(pseudoItem);
                            openProcessedDetail(item);
                          }} className="text-[13px] font-medium text-[#1C1917] bg-[#FAFAF9] hover:bg-[#F5F5F4] px-3 py-1.5 rounded-lg border border-[#E7E5E4] transition-colors">
                            <Eye className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />查看
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              <PaginationBar pagination={pagination} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={!!selectedApproval}
        onClose={() => { setSelectedApproval(null); setApprovalDetail(null); }}
        title={selectedApproval ? `${BUSINESS_TYPE_LABELS[selectedApproval.businessType] || selectedApproval.businessType} - 审批处理` : "审批处理"}
        maxWidth="700px"
      >
        {selectedApproval && (
          <div className="space-y-4">
            <BusinessDetailPanel
              businessType={selectedApproval.businessType}
              data={businessDetail}
              loading={businessDetailLoading}
            />

            <ApprovalInfoPanel instance={approvalDetail} />

            <div className="pt-3 border-t border-[#F5F5F4]">
              <h4 className="text-[13px] font-bold text-[#1C1917] mb-3">审批流程</h4>
              <ApprovalTimeline instance={approvalDetail} loading={detailLoading} />
            </div>

            {activeTab === "pending" && (
              <div className="pt-3 border-t border-[#F5F5F4]">
                <ApprovalActionButton
                  instanceId={approvalDetail?.id || null}
                  businessType={selectedApproval.businessType}
                  businessId={selectedApproval.businessId}
                  flowLevel={selectedApproval.flowLevel}
                  currentStatus={approvalDetail?.status || "审批中"}
                  approvalInstance={approvalDetail || undefined}
                  onStatusChange={handleStatusChange}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
