"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Trophy, DollarSign, TrendingUp, Eye, BarChart3 } from "lucide-react";
import Modal from "@/components/Modal";

interface ProjectLeadBrief {
  id: string;
  projectSourceId: string;
  projectName: string;
  customer: { name: string };
}

interface Bidding {
  id: string;
  projectSourceId: string;
  tenderFileReg: string | null;
  bidDeadline: string | null;
  bondAmount: number | null;
  bondPaymentStatus: string;
  bidResult: string | null;
  bidAmount: number | null;
  score: number | null;
  failReason: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  projectLead: ProjectLeadBrief;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const resultConfig: Record<string, { color: string; label: string }> = {
  "中标": { color: "ios-badge-green", label: "中标" },
  "未中标": { color: "ios-badge-red", label: "未中标" },
};
const bondStatusConfig: Record<string, { color: string; label: string }> = {
  "未付": { color: "ios-badge-gray", label: "未付" },
  "已付": { color: "ios-badge-green", label: "已付" },
  "已退": { color: "ios-badge-blue", label: "已退" },
};

export default function BiddingsPage() {
  const [biddings, setBiddings] = useState<Bidding[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, pageSize: 20, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterResult, setFilterResult] = useState("");
  const [detailBidding, setDetailBidding] = useState<Bidding | null>(null);

  const fetchBiddings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterResult) params.set("bidResult", filterResult);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());
      const res = await fetch(`/api/biddings?${params}`);
      const json = await res.json();
      if (res.ok) { setBiddings(json.data); setPagination(json.pagination); }
    } catch (err) {
      console.error("获取投标列表失败:", err);
    } finally { setLoading(false); }
  }, [search, filterResult, pagination.page, pagination.pageSize]);

  useEffect(() => { fetchBiddings(); }, [fetchBiddings]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const formatMoney = (amount: number | null) => {
    if (!amount) return "-";
    return `¥${Number(amount).toLocaleString("zh-CN")}`;
  };

  const winCount = biddings.filter((b) => b.bidResult === "中标").length;
  const loseCount = biddings.filter((b) => b.bidResult === "未中标").length;
  const pendingCount = biddings.filter((b) => !b.bidResult).length;
  const totalBidAmount = biddings.reduce((s, b) => s + (b.bidAmount || 0), 0);
  const winRate = biddings.filter((b) => b.bidResult).length > 0
    ? ((winCount / biddings.filter((b) => b.bidResult).length) * 100).toFixed(1)
    : "-";

  return (
    <>
      <div className="page-header">
        <div>
          <h1>投标统计</h1>
          <p>查看投标数据汇总与分析</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bento-card-static flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-[#1C1917]" /></div>
          <div><p className="text-[12px] text-[#78716C]">投标总数</p><p className="text-[20px] font-bold text-[#1C1917]">{pagination.total}</p></div>
        </div>
        <div className="bento-card-static flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#78716C]/10 flex items-center justify-center"><Trophy className="w-5 h-5 text-[#78716C]" /></div>
          <div><p className="text-[12px] text-[#78716C]">中标</p><p className="text-[20px] font-bold text-[#78716C]">{winCount}</p></div>
        </div>
        <div className="bento-card-static flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#78716C]/10 flex items-center justify-center"><Trophy className="w-5 h-5 text-[#78716C]" /></div>
          <div><p className="text-[12px] text-[#78716C]">未中标</p><p className="text-[20px] font-bold text-[#78716C]">{loseCount}</p></div>
        </div>
        <div className="bento-card-static flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#78716C]/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-[#78716C]" /></div>
          <div><p className="text-[12px] text-[#78716C]">中标率</p><p className="text-[20px] font-bold text-[#78716C]">{winRate}%</p></div>
        </div>
        <div className="bento-card-static flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#78716C]/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-[#78716C]" /></div>
          <div><p className="text-[12px] text-[#78716C]">投标总金额</p><p className="text-[16px] font-bold text-[#1C1917]">{formatMoney(totalBidAmount)}</p></div>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
            <input type="text" className="ios-input pl-10" placeholder="搜索项目ID、名称..." value={search} onChange={(e) => { setSearch(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }} />
          </div>
          <select className="ios-select w-[140px]" value={filterResult} onChange={(e) => { setFilterResult(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}>
            <option value="">全部结果</option>
            <option value="中标">中标</option>
            <option value="未中标">未中标</option>
          </select>
          <div className="ml-auto text-[13px] text-[#78716C]">共 <span className="font-semibold text-[#1C1917]">{pagination.total}</span> 条记录</div>
        </div>

        {loading ? (
          <div className="empty-state"><div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" /><p>加载中...</p></div>
        ) : biddings.length === 0 ? (
          <div className="empty-state"><Trophy className="w-8 h-8 text-[#78716C]" /><p>{search || filterResult ? "没有匹配的投标记录" : "暂无投标记录"}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead><tr><th>项目源ID</th><th>项目名称</th><th>客户</th><th>投标截止</th><th>保证金</th><th>投标金额</th><th>投标结果</th><th>操作</th></tr></thead>
              <tbody>
                {biddings.map((b) => {
                  const rc = b.bidResult ? resultConfig[b.bidResult] : null;
                  const bsc = bondStatusConfig[b.bondPaymentStatus] || bondStatusConfig["未付"];
                  return (
                    <tr key={b.id}>
                      <td><span className="font-mono text-[13px] font-semibold text-[#1C1917]">{b.projectSourceId}</span></td>
                      <td className="font-semibold">{b.projectLead.projectName}</td>
                      <td>{b.projectLead.customer.name}</td>
                      <td className="text-[#78716C]">{formatDate(b.bidDeadline)}</td>
                      <td><div className="flex items-center gap-1.5"><span className="text-[#78716C]">{formatMoney(b.bondAmount)}</span><span className={`ios-badge text-[10px] ${bsc.color}`}>{bsc.label}</span></div></td>
                      <td className="font-semibold">{formatMoney(b.bidAmount)}</td>
                      <td>{rc ? <span className={`ios-badge ${rc.color}`}>{rc.label}</span> : <span className="ios-badge ios-badge-gray">待定</span>}</td>
                      <td><button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => setDetailBidding(b)}><Eye className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-[#F5F5F4]">
                <button className="ios-btn ios-btn-secondary ios-btn-sm" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>上一页</button>
                <span className="text-[13px] text-[#78716C] px-3">{pagination.page} / {pagination.totalPages}</span>
                <button className="ios-btn ios-btn-secondary ios-btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>下一页</button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={!!detailBidding} onClose={() => setDetailBidding(null)} title="投标详情" maxWidth="680px">
        {detailBidding && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F5F5F4]">
              <div className="w-12 h-12 rounded-2xl bg-[#78716C]/10 flex items-center justify-center"><Trophy className="w-6 h-6 text-[#78716C]" /></div>
              <div><p className="text-[17px] font-bold text-[#1C1917]">{detailBidding.projectLead.projectName}</p><p className="text-[13px] text-[#1C1917] font-mono font-semibold">{detailBidding.projectSourceId}</p></div>
              {detailBidding.bidResult ? <span className={`ios-badge ml-auto ${resultConfig[detailBidding.bidResult]?.color || "ios-badge-gray"}`}>{detailBidding.bidResult}</span> : <span className="ios-badge ios-badge-gray ml-auto">待定</span>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#FAFAF9]"><p className="text-[12px] text-[#78716C] mb-1">客户</p><p className="text-[14px] font-semibold text-[#1C1917]">{detailBidding.projectLead.customer.name}</p></div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]"><p className="text-[12px] text-[#78716C] mb-1">投标截止</p><p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailBidding.bidDeadline)}</p></div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]"><p className="text-[12px] text-[#78716C] mb-1">投标金额</p><p className="text-[14px] font-semibold text-[#1C1917]">{formatMoney(detailBidding.bidAmount)}</p></div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]"><p className="text-[12px] text-[#78716C] mb-1">保证金 / 状态</p><p className="text-[14px] font-semibold text-[#1C1917]">{formatMoney(detailBidding.bondAmount)} <span className={`ios-badge text-[10px] ${bondStatusConfig[detailBidding.bondPaymentStatus]?.color || "ios-badge-gray"}`}>{detailBidding.bondPaymentStatus}</span></p></div>
              {detailBidding.score && <div className="p-3 rounded-xl bg-[#FAFAF9]"><p className="text-[12px] text-[#78716C] mb-1">评分</p><p className="text-[14px] font-semibold text-[#1C1917]">{detailBidding.score}</p></div>}
              {detailBidding.tenderFileReg && <div className="p-3 rounded-xl bg-[#FAFAF9]"><p className="text-[12px] text-[#78716C] mb-1">招标文件登记号</p><p className="text-[14px] font-semibold text-[#1C1917]">{detailBidding.tenderFileReg}</p></div>}
              {detailBidding.failReason && <div className="p-3 rounded-xl bg-[#FAFAF9] col-span-2"><p className="text-[12px] text-[#78716C] mb-1">未中标原因</p><p className="text-[14px] font-semibold text-[#1C1917]">{detailBidding.failReason}</p></div>}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
