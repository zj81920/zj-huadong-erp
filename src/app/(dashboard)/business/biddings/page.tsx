"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Trophy,
  Calendar,
  DollarSign,
  FileCheck,
  Shield,
} from "lucide-react";
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

interface BiddingFormData {
  projectSourceId: string;
  tenderFileReg: string;
  bidDeadline: string;
  bondAmount: string;
  bondPaymentStatus: string;
  bidResult: string;
  bidAmount: string;
  score: string;
  failReason: string;
  attachmentUrl: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyForm: BiddingFormData = {
  projectSourceId: "",
  tenderFileReg: "",
  bidDeadline: "",
  bondAmount: "",
  bondPaymentStatus: "未付",
  bidResult: "",
  bidAmount: "",
  score: "",
  failReason: "",
  attachmentUrl: "",
};

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

  const [showModal, setShowModal] = useState(false);
  const [editingBidding, setEditingBidding] = useState<Bidding | null>(null);
  const [form, setForm] = useState<BiddingFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [projectLeads, setProjectLeads] = useState<ProjectLeadBrief[]>([]);

  const [detailBidding, setDetailBidding] = useState<Bidding | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Bidding | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProjectLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/project-leads?pageSize=200");
      const json = await res.json();
      if (res.ok) {
        setProjectLeads(
          json.data.map((l: { id: string; projectSourceId: string; projectName: string; customer: { name: string } }) => ({
            id: l.id,
            projectSourceId: l.projectSourceId,
            projectName: l.projectName,
            customer: l.customer,
          }))
        );
      }
    } catch (err) {
      console.error("获取项目线索失败:", err);
    }
  }, []);

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
      if (res.ok) {
        setBiddings(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取投标列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterResult, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchProjectLeads();
  }, [fetchProjectLeads]);

  useEffect(() => {
    fetchBiddings();
  }, [fetchBiddings]);

  const handleOpenCreate = () => {
    setEditingBidding(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (bidding: Bidding) => {
    setEditingBidding(bidding);
    setForm({
      projectSourceId: bidding.projectSourceId,
      tenderFileReg: bidding.tenderFileReg || "",
      bidDeadline: bidding.bidDeadline ? bidding.bidDeadline.split("T")[0] : "",
      bondAmount: bidding.bondAmount ? String(bidding.bondAmount) : "",
      bondPaymentStatus: bidding.bondPaymentStatus,
      bidResult: bidding.bidResult || "",
      bidAmount: bidding.bidAmount ? String(bidding.bidAmount) : "",
      score: bidding.score ? String(bidding.score) : "",
      failReason: bidding.failReason || "",
      attachmentUrl: bidding.attachmentUrl || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.projectSourceId) {
      setFormError("请选择关联的项目线索");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingBidding
        ? `/api/biddings/${editingBidding.id}`
        : "/api/biddings";
      const method = editingBidding ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchBiddings();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/biddings/${deleteConfirm.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchBiddings();
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
        setDeleteConfirm(null);
      }
    } catch {
      alert("网络错误");
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const updateForm = (field: keyof BiddingFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatMoney = (amount: number | null) => {
    if (!amount) return "-";
    return `¥${Number(amount).toLocaleString("zh-CN")}`;
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>投标管理</h1>
            <p>管理投标记录、保证金、投标结果</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增投标
          </button>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索项目ID、名称..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <select
            className="ios-select w-[140px]"
            value={filterResult}
            onChange={(e) => {
              setFilterResult(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部结果</option>
            <option value="中标">中标</option>
            <option value="未中标">未中标</option>
          </select>

          <div className="ml-auto text-[13px] text-[#86868B]">
            共 <span className="font-semibold text-[#1D1D1F]">{pagination.total}</span> 条记录
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : biddings.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
              <Trophy className="w-8 h-8 text-[#86868B]" />
            </div>
            <p>{search || filterResult ? "没有匹配的投标记录" : "暂无投标记录，点击右上角新增"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>项目源ID</th>
                  <th>项目名称</th>
                  <th>客户</th>
                  <th>投标截止</th>
                  <th>保证金</th>
                  <th>投标金额</th>
                  <th>投标结果</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {biddings.map((bidding) => {
                  const rc = bidding.bidResult ? resultConfig[bidding.bidResult] : null;
                  const bsc = bondStatusConfig[bidding.bondPaymentStatus] || bondStatusConfig["未付"];
                  return (
                    <tr key={bidding.id}>
                      <td>
                        <span className="font-mono text-[13px] font-semibold text-[#007AFF]">
                          {bidding.projectSourceId}
                        </span>
                      </td>
                      <td className="font-semibold">{bidding.projectLead.projectName}</td>
                      <td>{bidding.projectLead.customer.name}</td>
                      <td className="text-[#86868B]">{formatDate(bidding.bidDeadline)}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#86868B]">{formatMoney(bidding.bondAmount)}</span>
                          <span className={`ios-badge text-[10px] ${bsc.color}`}>{bsc.label}</span>
                        </div>
                      </td>
                      <td className="font-semibold">{formatMoney(bidding.bidAmount)}</td>
                      <td>
                        {rc ? (
                          <span className={`ios-badge ${rc.color}`}>{rc.label}</span>
                        ) : (
                          <span className="ios-badge ios-badge-gray">待定</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => setDetailBidding(bidding)}>
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleOpenEdit(bidding)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!" onClick={() => setDeleteConfirm(bidding)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-[#F0F0F0]">
                <button
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  上一页
                </button>
                <span className="text-[13px] text-[#86868B] px-3">{pagination.page} / {pagination.totalPages}</span>
                <button
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingBidding ? "编辑投标记录" : "新增投标"}
        maxWidth="640px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">{formError}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                关联项目线索 <span className="text-[#FF3B30]">*</span>
              </label>
              <select
                className="ios-select"
                value={form.projectSourceId}
                onChange={(e) => updateForm("projectSourceId", e.target.value)}
                disabled={!!editingBidding}
              >
                <option value="">请选择项目线索</option>
                {projectLeads.map((l) => (
                  <option key={l.projectSourceId} value={l.projectSourceId}>
                    {l.projectSourceId} - {l.projectName} ({l.customer.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">投标截止时间</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input type="date" className="ios-input pl-10" value={form.bidDeadline} onChange={(e) => updateForm("bidDeadline", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">投标金额（元）</label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input type="number" className="ios-input pl-10" placeholder="投标金额" value={form.bidAmount} onChange={(e) => updateForm("bidAmount", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">保证金（元）</label>
              <div className="relative">
                <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input type="number" className="ios-input pl-10" placeholder="保证金金额" value={form.bondAmount} onChange={(e) => updateForm("bondAmount", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">保证金状态</label>
              <select className="ios-select" value={form.bondPaymentStatus} onChange={(e) => updateForm("bondPaymentStatus", e.target.value)}>
                <option value="未付">未付</option>
                <option value="已付">已付</option>
                <option value="已退">已退</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">投标结果</label>
              <select className="ios-select" value={form.bidResult} onChange={(e) => updateForm("bidResult", e.target.value)}>
                <option value="">待定</option>
                <option value="中标">中标</option>
                <option value="未中标">未中标</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">评分</label>
              <input type="number" step="0.1" className="ios-input" placeholder="投标评分" value={form.score} onChange={(e) => updateForm("score", e.target.value)} />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">招标文件登记号</label>
              <div className="relative">
                <FileCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input type="text" className="ios-input pl-10" placeholder="招标文件编号" value={form.tenderFileReg} onChange={(e) => updateForm("tenderFileReg", e.target.value)} />
              </div>
            </div>

            {form.bidResult === "未中标" && (
              <div className="col-span-2">
                <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">未中标原因</label>
                <textarea className="ios-textarea" placeholder="请说明未中标原因" value={form.failReason} onChange={(e) => updateForm("failReason", e.target.value)} />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "保存中..." : editingBidding ? "保存修改" : "创建投标记录"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailBidding}
        onClose={() => setDetailBidding(null)}
        title="投标详情"
        maxWidth="680px"
      >
        {detailBidding && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F0F0F0]">
              <div className="w-12 h-12 rounded-2xl bg-[#FF9500]/10 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-[#FF9500]" />
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#1D1D1F]">{detailBidding.projectLead.projectName}</p>
                <p className="text-[13px] text-[#007AFF] font-mono font-semibold">{detailBidding.projectSourceId}</p>
              </div>
              {detailBidding.bidResult ? (
                <span className={`ios-badge ml-auto ${resultConfig[detailBidding.bidResult]?.color || "ios-badge-gray"}`}>
                  {detailBidding.bidResult}
                </span>
              ) : (
                <span className="ios-badge ios-badge-gray ml-auto">待定</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">客户</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{detailBidding.projectLead.customer.name}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">投标截止</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{formatDate(detailBidding.bidDeadline)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">投标金额</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{formatMoney(detailBidding.bidAmount)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">保证金 / 状态</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">
                  {formatMoney(detailBidding.bondAmount)}{" "}
                  <span className={`ios-badge text-[10px] ${bondStatusConfig[detailBidding.bondPaymentStatus]?.color || "ios-badge-gray"}`}>
                    {detailBidding.bondPaymentStatus}
                  </span>
                </p>
              </div>
              {detailBidding.score && (
                <div className="p-3 rounded-xl bg-[#F5F5F7]">
                  <p className="text-[12px] text-[#86868B] mb-1">评分</p>
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">{detailBidding.score}</p>
                </div>
              )}
              {detailBidding.failReason && (
                <div className="p-3 rounded-xl bg-[#F5F5F7] col-span-2">
                  <p className="text-[12px] text-[#86868B] mb-1">未中标原因</p>
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">{detailBidding.failReason}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="确认删除"
        maxWidth="400px"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#FF3B30]" />
          </div>
          <p className="text-[15px] text-[#1D1D1F] mb-1">确定要删除该投标记录吗？</p>
          <p className="text-[13px] text-[#86868B] mb-6">此操作不可撤销</p>
          <div className="flex justify-center gap-3">
            <button className="ios-btn ios-btn-secondary" onClick={() => setDeleteConfirm(null)}>取消</button>
            <button className="ios-btn ios-btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
