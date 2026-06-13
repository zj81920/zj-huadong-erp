"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Calculator, DollarSign, TrendingUp, Eye, BarChart3 } from "lucide-react";
import Modal from "@/components/Modal";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";
import { getRowStatusClass } from "@/lib/status-colors";
import { QuotationDetailCard } from "@/components/detail-cards";

interface Customer {
  id: string;
  name: string;
  ownershipType: string | null;
}

interface Quotation {
  id: string;
  projectSourceId: string | null;
  customerId: string;
  estimatedCost: Record<string, unknown>;
  totalAmount: number;
  profitMargin: number | null;
  approvalStatus: string;
  status: string;
  version: number;
  adjustmentReason: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  customer: Customer;
  projectLead: { id: string; projectSourceId: string; projectName: string } | null;
}

const quotationStatusConfig: Record<string, { color: string; label: string }> = {
  "跟踪": { color: "ios-badge-gray", label: "跟踪" },
  "落地": { color: "ios-badge-green", label: "落地" },
  "放弃": { color: "ios-badge-red", label: "放弃" },
};

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const { page, pageSize, setPage, setPageSize, pagination, setPagination } = usePagination({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [detailQuotation, setDetailQuotation] = useState<Quotation | null>(null);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());
      const res = await fetch(`/api/quotations?${params}`);
      const json = await res.json();
      if (res.ok) { setQuotations(json.data); setPagination(json.pagination); }
    } catch (err) {
      console.error("获取报价单列表失败:", err);
    } finally { setLoading(false); }
  }, [search, filterStatus, page, pageSize]);

  useEffect(() => { fetchQuotations(); }, [fetchQuotations]);

  const formatMoney = (amount: number | null) => {
    if (!amount) return "-";
    return `¥${Number(amount).toLocaleString("zh-CN")}`;
  };
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const approvedCount = quotations.filter((q) => q.status === "落地").length;
  const pendingCount = quotations.filter((q) => q.status === "跟踪").length;
  const draftCount = quotations.length - approvedCount - pendingCount;
  const totalAmount = quotations.reduce((s, q) => s + (q.totalAmount || 0), 0);
  const profitMargins = quotations.filter((q) => q.profitMargin);
  const avgProfit = profitMargins.length > 0 ? profitMargins.reduce((s, q) => s + (q.profitMargin || 0), 0) / profitMargins.length : null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>报价统计</h1>
          <p>查看报价数据汇总与分析</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bento-card-static flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-[#1C1917]" /></div>
          <div><p className="text-[12px] text-[#78716C]">报价总数</p><p className="text-[20px] font-bold text-[#1C1917]">{pagination?.total ?? 0}</p></div>
        </div>
        <div className="bento-card-static flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#78716C]/10 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-[#78716C]" /></div>
          <div><p className="text-[12px] text-[#78716C]">已落地</p><p className="text-[20px] font-bold text-[#78716C]">{approvedCount}</p></div>
        </div>
        <div className="bento-card-static flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#78716C]/10 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-[#78716C]" /></div>
          <div><p className="text-[12px] text-[#78716C]">跟踪中</p><p className="text-[20px] font-bold text-[#78716C]">{pendingCount}</p></div>
        </div>
        <div className="bento-card-static flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#78716C]/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-[#78716C]" /></div>
          <div><p className="text-[12px] text-[#78716C]">报价总金额</p><p className="text-[16px] font-bold text-[#1C1917]">{formatMoney(totalAmount)}</p></div>
        </div>
        <div className="bento-card-static flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-[#1C1917]" /></div>
          <div><p className="text-[12px] text-[#78716C]">平均利润率</p><p className="text-[20px] font-bold text-[#78716C]">{avgProfit !== null ? `${avgProfit.toFixed(1)}%` : "-"}</p></div>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
            <input type="text" className="ios-input pl-10" placeholder="搜索客户、项目名称..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="ios-select w-[140px]" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">全部状态</option>
            <option value="跟踪">跟踪</option>
            <option value="落地">落地</option>
            <option value="放弃">放弃</option>
          </select>
          <div className="ml-auto text-[13px] text-[#78716C]">共 <span className="font-semibold text-[#1C1917]">{pagination?.total ?? 0}</span> 条记录</div>
        </div>

        {loading ? (
          <div className="empty-state"><div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" /><p>加载中...</p></div>
        ) : quotations.length === 0 ? (
          <div className="empty-state"><Calculator className="w-8 h-8 text-[#78716C]" /><p>{search || filterStatus ? "没有匹配的报价单" : "暂无报价单"}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead><tr><th>客户</th><th>关联项目</th><th>报价金额</th><th>利润率</th><th>版本</th><th>报价状态</th><th>操作</th><th>最后修改</th></tr></thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id} className={getRowStatusClass(q.status)}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[11px] font-bold text-[#1C1917]">{q.customer.name[0]}</span>
                        </div>
                        <span className="font-semibold">{q.customer.name}</span>
                      </div>
                    </td>
                    <td>{q.projectLead ? <span className="font-mono text-[12px] text-[#1C1917]">{q.projectLead.projectSourceId}</span> : <span className="text-[#78716C]">-</span>}</td>
                    <td className="font-semibold">{formatMoney(q.totalAmount)}</td>
                    <td>{q.profitMargin ? <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-[#78716C]" /><span className="text-[#78716C] font-semibold">{q.profitMargin}%</span></span> : "-"}</td>
                    <td><span className="ios-badge ios-badge-gray">v{q.version}</span></td>
                    <td><span className={`ios-badge ${quotationStatusConfig[q.status]?.color || "ios-badge-gray"}`}>{quotationStatusConfig[q.status]?.label || q.status}</span></td>
                    <td><button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => setDetailQuotation(q)}><Eye className="w-3.5 h-3.5" /></button></td>
                    <td className="text-[#78716C] text-[12px] whitespace-nowrap">
                      {q.lastModifiedBy && (
                        <span>{q.lastModifiedBy}</span>
                      )}
                      <span className="block text-[11px]">{formatDate(q.updatedAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar pagination={pagination} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </div>
        )}
      </div>

      <Modal isOpen={!!detailQuotation} onClose={() => setDetailQuotation(null)} title="报价单详情" maxWidth="680px">
        {detailQuotation && (
          <QuotationDetailCard data={detailQuotation} />
        )}
      </Modal>
    </>
  );
}
