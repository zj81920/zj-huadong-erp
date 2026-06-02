"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  ArrowUpCircle,
  ArrowDownCircle,
  ChevronRight,
  X,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Project {
  id: string;
  projectSourceId: string;
  name: string;
  projectCode: string;
}

interface ProjectLeadItem {
  id: string;
  projectSourceId: string;
  projectName: string;
  customerId: string;
  customer: { id: string; name: string };
  currentStatus: string;
}

interface NonContractRecord {
  id: string;
  projectSourceId: string | null;
  amount: number;
  transactionDate: string;
  counterparty: string;
  description: string | null;
  status: "草稿" | "审批中" | "已批准" | "已驳回";
  approvalInstanceId: string | null;
  createdAt: string;
  updatedAt: string;
  project: Project | null;
}

interface NonContractFormData {
  counterparty: string;
  amount: string;
  transactionDate: string;
  projectSourceId: string;
  description: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type TabType = "income" | "expense";

const emptyForm: NonContractFormData = {
  counterparty: "",
  amount: "",
  transactionDate: "",
  projectSourceId: "",
  description: "",
};

const statusConfig: Record<string, { color: string; label: string }> = {
  草稿: { color: "ios-badge-gray", label: "草稿" },
  审批中: { color: "ios-badge-orange", label: "审批中" },
  已批准: { color: "ios-badge-green", label: "已批准" },
  已驳回: { color: "ios-badge-red", label: "已驳回" },
};

const statusFlow: Record<string, string[]> = {
  草稿: ["审批中"],
  审批中: ["已批准", "已驳回"],
  已批准: [],
  已驳回: [],
};

const statusActionsMap: Record<string, string> = {
  草稿: "提交审批",
  审批中: "确认通过",
};

export default function NonContractPage() {
  const [activeTab, setActiveTab] = useState<TabType>("income");
  const [records, setRecords] = useState<NonContractRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProject, setFilterProject] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<NonContractRecord | null>(null);
  const [form, setForm] = useState<NonContractFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLeads, setProjectLeads] = useState<ProjectLeadItem[]>([]);
  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [leadSearchText, setLeadSearchText] = useState("");

  const [detailRecord, setDetailRecord] = useState<NonContractRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<NonContractRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const apiUrl = activeTab === "income" ? "/api/non-contract-incomes" : "/api/non-contract-expenses";

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects?pageSize=200");
      const json = await res.json();
      if (res.ok) {
        setProjects(
          json.data.map((p: { id: string; projectSourceId: string; name: string; projectCode: string }) => ({
            id: p.id,
            projectSourceId: p.projectSourceId,
            name: p.name,
            projectCode: p.projectCode,
          }))
        );
      }
    } catch (err) {
      console.error("获取项目列表失败:", err);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      if (filterProject) params.set("projectSourceId", filterProject);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`${apiUrl}?${params}`);
      const json = await res.json();
      if (res.ok) {
        setRecords(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取数据失败:", err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, search, filterStatus, filterProject, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchProjects();
    const fetchProjectLeads = async () => {
      try {
        const res = await fetch("/api/project-leads?pageSize=200");
        if (res.ok) {
          const json = await res.json();
          setProjectLeads(
            (json.data || []).filter(
              (l: { currentStatus: string }) => l.currentStatus !== "放弃"
            )
          );
        }
      } catch {
        setProjectLeads([]);
      }
    };
    fetchProjectLeads();
  }, [fetchProjects]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearch("");
    setFilterStatus("");
    setFilterProject("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (record: NonContractRecord) => {
    setEditingRecord(record);
    setForm({
      counterparty: record.counterparty,
      amount: String(record.amount),
      transactionDate: record.transactionDate ? record.transactionDate.split("T")[0] : "",
      projectSourceId: record.projectSourceId || "",
      description: record.description || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.counterparty) {
      setFormError("请填写交易对方");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setFormError("请填写有效金额");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingRecord ? `${apiUrl}/${editingRecord.id}` : apiUrl;
      const method = editingRecord ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        counterparty: form.counterparty,
        amount: Number(form.amount),
        transactionDate: form.transactionDate || null,
        description: form.description || null,
        projectSourceId: form.projectSourceId || null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchRecords();
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
      const res = await fetch(`${apiUrl}/${deleteConfirm.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchRecords();
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

  const handleStatusChange = async (record: NonContractRecord, newStatus: string) => {
    try {
      const res = await fetch(`${apiUrl}/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchRecords();
      } else {
        const json = await res.json();
        alert(json.error || "状态变更失败");
      }
    } catch {
      alert("网络错误");
    }
  };

  const updateForm = (field: keyof NonContractFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatAmount = (amount: number, type: TabType) => {
    const formatted = `¥${Number(amount).toLocaleString("zh-CN")}`;
    return type === "income" ? (
      <span className="text-[#34C759] font-semibold">{formatted}</span>
    ) : (
      <span className="text-[#FF3B30] font-semibold">{formatted}</span>
    );
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig["草稿"];
    return <span className={`ios-badge ${config.color}`}>{config.label}</span>;
  };

  const tabLabel = activeTab === "income" ? "非合同收入" : "非合同支出";
  const isIncome = activeTab === "income";

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>非合同收支</h1>
            <p>管理非合同收入与支出，支持按项目或公司级记录</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增{isIncome ? "收入" : "支出"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <button
          className={`ios-btn ${isIncome ? "ios-btn-primary" : "ios-btn-secondary"}`}
          onClick={() => handleTabChange("income")}
        >
          <ArrowUpCircle className="w-4 h-4" />
          非合同收入
        </button>
        <button
          className={`ios-btn ${!isIncome ? "ios-btn-primary" : "ios-btn-secondary"}`}
          onClick={() => handleTabChange("expense")}
        >
          <ArrowDownCircle className="w-4 h-4" />
          非合同支出
        </button>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索交易对方、描述..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <select
            className="ios-select w-[140px]"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部状态</option>
            <option value="草稿">草稿</option>
            <option value="审批中">审批中</option>
            <option value="已批准">已批准</option>
            <option value="已驳回">已驳回</option>
          </select>

          <select
            className="ios-select w-[180px]"
            value={filterProject}
            onChange={(e) => {
              setFilterProject(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部项目</option>
            {projectLeads.map((l) => (
              <option key={l.projectSourceId} value={l.projectSourceId}>
                {l.projectSourceId} - {l.projectName}
              </option>
            ))}
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
        ) : records.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
              {isIncome ? (
                <ArrowUpCircle className="w-8 h-8 text-[#86868B]" />
              ) : (
                <ArrowDownCircle className="w-8 h-8 text-[#86868B]" />
              )}
            </div>
            <p>{search || filterStatus || filterProject ? `没有匹配的${tabLabel}记录` : `暂无${tabLabel}记录，点击右上角新增`}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>交易对方</th>
                  <th>金额</th>
                  <th>交易日期</th>
                  <th>项目源</th>
                  <th>描述</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const nextStatuses = statusFlow[record.status] || [];
                  return (
                    <tr key={record.id}>
                      <td className="font-semibold">{record.counterparty}</td>
                      <td>{formatAmount(record.amount, activeTab)}</td>
                      <td className="text-[#86868B]">{formatDate(record.transactionDate)}</td>
                      <td>
                        {record.projectSourceId ? (
                          <div>
                            <span className="font-mono text-[13px] font-semibold text-[#007AFF]">
                              {record.projectSourceId}
                            </span>
                            {record.project && (
                              <p className="text-[11px] text-[#86868B] mt-0.5">{record.project.name}</p>
                            )}
                          </div>
                        ) : (
                          <span className="ios-badge ios-badge-blue">公司级</span>
                        )}
                      </td>
                      <td className="text-[#86868B] max-w-[200px] truncate">
                        {record.description || "-"}
                      </td>
                      <td>{getStatusBadge(record.status)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => setDetailRecord(record)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => handleOpenEdit(record)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                            onClick={() => setDeleteConfirm(record)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {nextStatuses.length > 0 && (
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF]!"
                              onClick={() => handleStatusChange(record, nextStatuses[0])}
                              title={statusActionsMap[record.status]}
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
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
                <span className="text-[13px] text-[#86868B] px-3">
                  {pagination.page} / {pagination.totalPages}
                </span>
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
        title={editingRecord ? `编辑${tabLabel}` : `新增${tabLabel}`}
        maxWidth="600px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                交易对方 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入交易对方名称"
                value={form.counterparty}
                onChange={(e) => updateForm("counterparty", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                金额（元） <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="number"
                className="ios-input"
                placeholder="请输入金额"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => updateForm("amount", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                交易日期
              </label>
              <input
                type="date"
                className="ios-input"
                value={form.transactionDate}
                onChange={(e) => updateForm("transactionDate", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                关联项目
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center ios-input min-h-[40px]">
                  {form.projectSourceId ? (
                    <>
                      <span className="flex-1 truncate text-[13px]">
                        <span className="font-mono font-semibold text-[#007AFF]">{form.projectSourceId}</span>
                        <span className="mx-1">-</span>
                        <span>{projectLeads.find((l) => l.projectSourceId === form.projectSourceId)?.projectName || ""}</span>
                      </span>
                      <X
                        className="w-4 h-4 text-[#86868B] hover:text-[#FF3B30] flex-shrink-0 cursor-pointer"
                        onClick={() => setForm((prev) => ({ ...prev, projectSourceId: "" }))}
                      />
                    </>
                  ) : (
                    <span className="flex-1 text-[13px] text-[#86868B]">不关联（公司级）</span>
                  )}
                </div>
                <button
                  type="button"
                  className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF] whitespace-nowrap"
                  onClick={() => {
                    setLeadSearchText("");
                    setShowLeadPicker(true);
                  }}
                >
                  <Search className="w-3.5 h-3.5" />
                  选择项目
                </button>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                描述
              </label>
              <textarea
                className="ios-textarea"
                placeholder="请输入描述信息"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>
              取消
            </button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "保存中..." : editingRecord ? "保存修改" : `创建${tabLabel}记录`}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        title={`${tabLabel}详情`}
        maxWidth="600px"
      >
        {detailRecord && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F0F0F0]">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  isIncome ? "bg-[#34C759]/10" : "bg-[#FF3B30]/10"
                }`}
              >
                {isIncome ? (
                  <ArrowUpCircle className="w-6 h-6 text-[#34C759]" />
                ) : (
                  <ArrowDownCircle className="w-6 h-6 text-[#FF3B30]" />
                )}
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#1D1D1F]">{detailRecord.counterparty}</p>
                <p className="text-[13px] text-[#86868B]">
                  {isIncome ? "收入" : "支出"} · {formatDate(detailRecord.transactionDate)}
                </p>
              </div>
              <span className={`ios-badge ml-auto ${statusConfig[detailRecord.status]?.color || "ios-badge-gray"}`}>
                {detailRecord.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">金额</p>
                <p className={`text-[14px] font-semibold ${isIncome ? "text-[#34C759]" : "text-[#FF3B30]"}`}>
                  ¥{Number(detailRecord.amount).toLocaleString("zh-CN")}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">交易日期</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">
                  {formatDate(detailRecord.transactionDate)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">项目源</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">
                  {detailRecord.projectSourceId ? (
                    <span>
                      <span className="font-mono text-[#007AFF]">{detailRecord.projectSourceId}</span>
                      {detailRecord.project && (
                        <span className="text-[#86868B] text-[12px] ml-1.5">{detailRecord.project.name}</span>
                      )}
                    </span>
                  ) : (
                    <span className="ios-badge ios-badge-blue">公司级</span>
                  )}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">创建时间</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{formatDate(detailRecord.createdAt)}</p>
              </div>
              {detailRecord.description && (
                <div className="p-3 rounded-xl bg-[#F5F5F7] col-span-2">
                  <p className="text-[12px] text-[#86868B] mb-1">描述</p>
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">{detailRecord.description}</p>
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
          <p className="text-[15px] text-[#1D1D1F] mb-1">确定要删除该{tabLabel}记录吗？</p>
          <p className="text-[13px] text-[#86868B] mb-6">此操作不可撤销</p>
          <div className="flex justify-center gap-3">
            <button className="ios-btn ios-btn-secondary" onClick={() => setDeleteConfirm(null)}>
              取消
            </button>
            <button className="ios-btn ios-btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showLeadPicker}
        onClose={() => setShowLeadPicker(false)}
        title="选择关联项目"
        maxWidth="720px"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索项目源ID、项目名称、客户名称..."
              value={leadSearchText}
              onChange={(e) => setLeadSearchText(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto rounded-xl border border-[#E5E5EA]">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>项目源ID</th>
                  <th>项目名称</th>
                  <th>客户</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {projectLeads
                  .filter((l) => {
                    if (!leadSearchText) return true;
                    const q = leadSearchText.toLowerCase();
                    return (
                      l.projectSourceId.toLowerCase().includes(q) ||
                      l.projectName.toLowerCase().includes(q) ||
                      l.customer.name.toLowerCase().includes(q)
                    );
                  })
                  .map((l) => (
                    <tr key={l.projectSourceId}>
                      <td>
                        <span className="font-mono text-[13px] font-semibold text-[#007AFF]">
                          {l.projectSourceId}
                        </span>
                      </td>
                      <td className="font-semibold">{l.projectName}</td>
                      <td>{l.customer.name}</td>
                      <td>
                        <span className="ios-badge ios-badge-blue">{l.currentStatus}</span>
                      </td>
                      <td>
                        <button
                          className={`ios-btn ios-btn-sm ${
                            form.projectSourceId === l.projectSourceId
                              ? "ios-btn-primary"
                              : "ios-btn-secondary"
                          }`}
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              projectSourceId: l.projectSourceId,
                            }));
                            setShowLeadPicker(false);
                            setLeadSearchText("");
                            if (formError) setFormError("");
                          }}
                        >
                          {form.projectSourceId === l.projectSourceId ? "已选择" : "选择"}
                        </button>
                      </td>
                    </tr>
                  ))}
                {projectLeads.filter((l) => {
                  if (!leadSearchText) return true;
                  const q = leadSearchText.toLowerCase();
                  return (
                    l.projectSourceId.toLowerCase().includes(q) ||
                    l.projectName.toLowerCase().includes(q) ||
                    l.customer.name.toLowerCase().includes(q)
                  );
                }).length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[#86868B]">
                      无匹配项目
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowLeadPicker(false)}
            >
              关闭
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
