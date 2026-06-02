"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  ShoppingCart,
  Calendar,
  Package,
  ArrowRight,
  Upload,
  Download,
  X,
  FileSpreadsheet,
  ChevronRight,
  ChevronDown,
  Paperclip,
  File,
} from "lucide-react";
import Modal from "@/components/Modal";
import AdminStatusOverride from "@/components/AdminStatusOverride";
import ProjectPicker from "@/components/ProjectPicker";
import { ApprovalTimeline } from "@/components/ApprovalComponents";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/AuthContext";
import { useFlowConfigured } from "@/hooks/useFlowConfigured";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";

interface PurchaseRequestItem {
  id: string;
  purchaseRequestId: string;
  materialName: string;
  spec: string | null;
  material: string | null;
  brand: string | null;
  standardNo: string | null;
  unit: string | null;
  quantity: string | null;
  remark: string | null;
  sortOrder: number;
}

interface PurchaseRequest {
  id: string;
  requestNo: string;
  projectSourceId: string;
  requestType: string;
  requiredDate: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  project: { projectSourceId: string; name: string };
  items: PurchaseRequestItem[];
  attachments: { name: string; url: string }[];
  inquiry?: Record<string, unknown> | null;
  approvalInstanceId?: string | null;
}

interface PurchaseRequestItemData {
  materialName: string;
  spec: string;
  material: string;
  brand: string;
  standardNo: string;
  unit: string;
  quantity: string;
  remark: string;
}

interface PurchaseRequestFormData {
  projectSourceId: string;
  requestType: string;
  requiredDate: string;
  items: PurchaseRequestItemData[];
  attachments: { name: string; url: string }[];
}

interface ProjectLeadItem {
  projectSourceId: string;
  projectName: string;
  customerId: string;
  customer: { id: string; name: string };
  currentStatus: string;
  project: { id: string; projectCode: string; name: string; status: string; projectCategory: string | null } | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyItem: PurchaseRequestItemData = {
  materialName: "",
  spec: "",
  material: "",
  brand: "",
  standardNo: "",
  unit: "",
  quantity: "",
  remark: "",
};

const emptyForm: PurchaseRequestFormData = {
  projectSourceId: "",
  requestType: "项目需求",
  requiredDate: "",
  items: [{ ...emptyItem }],
  attachments: [],
};

const statusColorMap: Record<string, string> = {
  "草稿": "ios-badge-gray",
  "审批中": "ios-badge-blue",
  "已批准": "ios-badge-green",
  "已驳回": "ios-badge-red",
  "已转询价": "ios-badge-blue",
  "已采购": "ios-badge-purple",
};

const excelColumnMap: Record<string, keyof PurchaseRequestItemData> = {
  "物资名称": "materialName",
  "规格型号": "spec",
  "材质": "material",
  "品牌": "brand",
  "适用标准号": "standardNo",
  "单位": "unit",
  "数量": "quantity",
  "备注": "remark",
};

export default function PurchaseRequestsPage() {
  const { user } = useAuth();
  const isAdminUser = user?.username === "admin";
  const { configured: flowConfigured } = useFlowConfigured("purchase_request");
  const [records, setRecords] = useState<PurchaseRequest[]>([]);
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

  const [projectLeads, setProjectLeads] = useState<ProjectLeadItem[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PurchaseRequest | null>(null);
  const [form, setForm] = useState<PurchaseRequestFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<PurchaseRequest | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [detailRecord, setDetailRecord] = useState<PurchaseRequest | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const [approvalInstance, setApprovalInstance] = useState<any>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);

  const {
    toggleSelect, selectAll, clearSelection, isAllSelected, selectedCount, isSelected,
  } = useBatchSelection(records.map((r) => r.id));

  const toggleRowExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const fetchApprovalInstance = useCallback(async (instanceId: string) => {
    setApprovalLoading(true);
    try {
      const res = await fetch(`/api/approval-instances/${instanceId}`);
      if (res.ok) {
        const json = await res.json();
        setApprovalInstance(json.data);
      } else {
        setApprovalInstance(null);
      }
    } catch {
      setApprovalInstance(null);
    } finally {
      setApprovalLoading(false);
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

      const res = await fetch(`/api/purchase-requests?${params}`);
      const json = await res.json();

      if (res.ok) {
        setRecords(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取采购需求列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterProject, pagination.page, pagination.pageSize]);

  const fetchProjectLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/project-leads?pageSize=200");
      const json = await res.json();
      if (res.ok) {
        setProjectLeads(
          (json.data || [])
            .filter((l: { currentStatus: string }) => l.currentStatus !== "放弃")
            .filter((l: { project: { projectCategory: string | null } | null }) =>
              l.project && (!l.project.projectCategory || l.project.projectCategory === "EP" || l.project.projectCategory === "EPcm")
            )
        );
      }
    } catch (err) {
      console.error("获取项目线索列表失败:", err);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    fetchProjectLeads();
  }, [fetchProjectLeads]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploadingFile(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const json = await res.json();
        if (res.ok) {
          setForm((prev) => ({
            ...prev,
            attachments: [...prev.attachments, { name: json.filename || file.name, url: json.url }],
          }));
        } else {
          alert(json.error || "上传失败");
        }
      }
    } catch {
      alert("上传失败");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setForm({ ...emptyForm, items: [{ ...emptyItem }] });
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (record: PurchaseRequest) => {
    setEditingRecord(record);
    setForm({
      projectSourceId: record.projectSourceId,
      requestType: record.requestType,
      requiredDate: record.requiredDate ? record.requiredDate.split("T")[0] : "",
      items:
        record.items && record.items.length > 0
          ? record.items
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((item) => ({
                materialName: item.materialName || "",
                spec: item.spec || "",
                material: item.material || "",
                brand: item.brand || "",
                standardNo: item.standardNo || "",
                unit: item.unit || "",
                quantity: item.quantity || "",
                remark: item.remark || "",
              }))
          : [{ ...emptyItem }],
      attachments: record.attachments && Array.isArray(record.attachments) ? record.attachments : [],
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.projectSourceId) {
      setFormError("请选择项目");
      return;
    }
    const validItems = form.items.filter((item) => item.materialName.trim());
    if (validItems.length === 0) {
      setFormError("至少需要一条物资明细");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        projectSourceId: form.projectSourceId,
        requestType: "项目需求",
        requiredDate: form.requiredDate || null,
        items: validItems.map((item, index) => ({
          ...item,
          sortOrder: index,
        })),
        attachments: form.attachments,
      };

      const url = editingRecord
        ? `/api/purchase-requests/${editingRecord.id}`
        : "/api/purchase-requests";
      const method = editingRecord ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    if (deleteConfirm.status !== "草稿" && deleteConfirm.status !== "已驳回" && !isAdminUser) {
      alert("该记录已进入审批流程，仅管理员可删除");
      setDeleteConfirm(null);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/purchase-requests/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        fetchRecords();
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
        setDeleteConfirm(null);
      }
    } catch {
      alert("网络错误，请重试");
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleConvertToInquiry = async (record: PurchaseRequest) => {
    if (!confirm(`确认将「${record.requestNo}」转为询价？`)) return;

    try {
      const res = await fetch(`/api/purchase-requests/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convertToInquiry: true }),
      });

      const json = await res.json();

      if (res.ok) {
        fetchRecords();
      } else {
        alert(json.error || "操作失败");
      }
    } catch {
      alert("网络错误，请重试");
    }
  };

  const handleViewDetail = async (record: PurchaseRequest) => {
    setApprovalInstance(null);
    try {
      const res = await fetch(`/api/purchase-requests/${record.id}`);
      const json = await res.json();
      if (res.ok) {
        setDetailRecord(json.data);
        if (json.data.approvalInstanceId) {
          fetchApprovalInstance(json.data.approvalInstanceId);
        }
      }
    } catch {
      alert("获取详情失败");
    }
  };

  const handleExcelImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        const importedItems: PurchaseRequestItemData[] = [];
        for (const row of rows) {
          const newItem = { ...emptyItem };
          for (const [header, value] of Object.entries(row)) {
            const field = excelColumnMap[header.trim()];
            if (field) {
              newItem[field] = String(value ?? "");
            }
          }
          if (newItem.materialName.trim()) {
            importedItems.push(newItem);
          }
        }

        if (importedItems.length === 0) {
          setFormError("未从Excel中解析到有效数据，请检查表头是否匹配");
          return;
        }

        setForm((prev) => ({
          ...prev,
          items: [...prev.items, ...importedItems],
        }));
        if (formError) setFormError("");
      } catch {
        setFormError("Excel解析失败，请检查文件格式");
      }
    };
    input.click();
  };

  const handleDownloadTemplate = () => {
    const headers = ["物资名称", "规格型号", "材质", "品牌", "适用标准号", "单位", "数量", "备注"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "采购明细");
    XLSX.writeFile(wb, "采购需求导入模板.xlsx");
  };

  const updateFormHeader = (field: "projectSourceId" | "requiredDate", value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const updateFormItem = (index: number, field: keyof PurchaseRequestItemData, value: string) => {
    setForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
    if (formError) setFormError("");
  };

  const addLineItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...emptyItem }],
    }));
  };

  const removeLineItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>采购需求</h1>
            <p>管理项目采购需求，跟踪审批及询价转办</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增需求
          </button>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索计划单号、项目名称..."
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
            <option value="已转询价">已转询价</option>
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
                {l.project ? `${l.project.projectCode} - ${l.project.name}` : `${l.projectSourceId} - ${l.projectName}`}
              </option>
            ))}
          </select>

          <div className="ml-auto text-[13px] text-[#6B7280]">
            共 <span className="font-semibold text-[#111827]">{pagination.total}</span> 条记录
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#111827] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F9FAFB] flex items-center justify-center">
              <ShoppingCart className="w-8 h-8 text-[#6B7280]" />
            </div>
            <p>{search || filterStatus || filterProject ? "没有匹配的采购需求" : "暂无采购需求，点击右上角新增"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  {isAdminUser && <th className="w-10"><input type="checkbox" className="ios-checkbox" checked={isAllSelected} onChange={() => isAllSelected ? clearSelection() : selectAll()} /></th>}
                  <th>计划单号</th>
                  <th>项目源ID</th>
                  <th>项目名称</th>
                  <th>物资明细数</th>
                  <th>需求日期</th>
                  <th>状态</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const isExpanded = expandedRows.has(record.id);
                  return (
                    <Fragment key={record.id}>
                      <tr className={`${isExpanded ? "bg-[#F9FAFB]/60" : ""} ${isSelected(record.id) ? "bg-[#111827]/5" : ""}`}>
                        {isAdminUser && (
                          <td className="w-10">
                            <input type="checkbox" className="ios-checkbox" checked={isSelected(record.id)} onChange={() => toggleSelect(record.id)} />
                          </td>
                        )}
                        <td>
                          <div className="flex items-center gap-1.5">
                            <button
                              className="w-6 h-6 rounded-md hover:bg-[#E5E7EB] flex items-center justify-center transition-colors"
                              onClick={() => toggleRowExpand(record.id)}
                              title={isExpanded ? "收起明细" : "展开明细"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-[#111827]" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-[#6B7280]" />
                              )}
                            </button>
                            <span className="font-mono text-[13px] font-semibold text-[#111827]">
                              {record.requestNo}
                            </span>
                          </div>
                        </td>
                        <td className="font-mono text-[13px]">{record.projectSourceId}</td>
                        <td>
                          <span className="font-semibold">{record.project?.name || "-"}</span>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1">
                            <Package className="w-3.5 h-3.5 text-[#6B7280]" />
                            <span className="ios-badge ios-badge-gray">{record.items?.length || 0}</span>
                          </span>
                        </td>
                        <td className="text-[#6B7280]">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(record.requiredDate)}
                          </span>
                        </td>
                        <td>
                          <AdminStatusOverride
                            businessType="purchase_request"
                            businessId={record.id}
                            currentStatus={record.status}
                            onStatusChanged={(newStatus) => {
                              setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: newStatus } : r));
                            }}
                          />
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => handleViewDetail(record)}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              详情
                            </button>
                            {record.status === "已批准" && (
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#111827]!"
                                onClick={() => {
                                  window.location.href = "/procurement/inquiries?prId=" + record.id;
                                }}
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                                转询价
                              </button>
                            )}
                            {(record.status === "草稿" || record.status === "已驳回" || isAdminUser) && (
                              <>
                                <button
                                  className="ios-btn ios-btn-ghost ios-btn-sm"
                                  onClick={() => handleOpenEdit(record)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  编辑
                                </button>
                                <button
                                  className="ios-btn ios-btn-ghost ios-btn-sm text-[#6B7280]!"
                                  onClick={() => setDeleteConfirm(record)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  删除
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="text-[#6B7280] text-[12px] whitespace-nowrap">
                          {record.lastModifiedBy && (
                            <span>{record.lastModifiedBy}</span>
                          )}
                          <span className="block text-[11px]">{formatDate(record.updatedAt)}</span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="p-0">
                            <div className="px-10 py-4 bg-[#FFFFFF] border-t border-b border-[#E5E7EB]">
                              <div className="flex items-center gap-2 mb-3">
                                <Package className="w-4 h-4 text-[#111827]" />
                                <span className="text-[13px] font-semibold text-[#111827]">
                                  物资明细（{record.items?.length || 0} 项）
                                </span>
                              </div>
                              {record.items && record.items.length > 0 ? (
                                <div className="overflow-x-auto border border-[#E5E7EB] rounded-xl bg-white">
                                  <table className="w-full text-[13px]">
                                    <thead className="bg-[#F9FAFB]">
                                      <tr>
                                        <th className="py-2 px-3 text-center font-semibold text-[#6B7280] w-[44px]">序号</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#111827]">物资名称</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#111827]">规格型号</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#111827]">材质</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#111827]">品牌</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#111827]">适用标准号</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#111827]">单位</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#111827]">数量</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#111827]">备注</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {record.items
                                        .sort((a, b) => a.sortOrder - b.sortOrder)
                                        .map((item, index) => (
                                          <tr key={item.id} className="border-t border-[#F3F4F6]">
                                            <td className="py-2 px-3 text-center text-[#6B7280]">{index + 1}</td>
                                            <td className="py-2 px-3 font-semibold">{item.materialName}</td>
                                            <td className="py-2 px-3">{item.spec || "-"}</td>
                                            <td className="py-2 px-3">{item.material || "-"}</td>
                                            <td className="py-2 px-3">{item.brand || "-"}</td>
                                            <td className="py-2 px-3">{item.standardNo || "-"}</td>
                                            <td className="py-2 px-3">{item.unit || "-"}</td>
                                            <td className="py-2 px-3 font-mono">{item.quantity || "-"}</td>
                                            <td className="py-2 px-3 text-[#6B7280]">{item.remark || "-"}</td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-[13px] text-[#6B7280] text-center py-4">暂无物资明细</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-[#F3F4F6]">
                <button
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  上一页
                </button>
                <span className="text-[13px] text-[#6B7280] px-3">
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

        {isAdminUser && (
          <BatchDeleteBar
            businessType="purchase_request"
            selectedIds={records.filter((d) => isSelected(d.id)).map((d) => d.id)}
            onDeleteSuccess={fetchRecords}
            onClear={clearSelection}
          />
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingRecord ? "编辑采购需求" : "新增采购需求"}
        maxWidth="860px"
      >
        <div className="space-y-5">
          {formError && (
            <div className="p-3 rounded-xl bg-[#6B7280]/8 text-[#6B7280] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <ProjectPicker
                projectLeads={projectLeads}
                value={form.projectSourceId}
                onChange={(id) => updateFormHeader("projectSourceId", id)}
                label="所属项目"
                placeholder="请选择项目"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">需求日期</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="date"
                  className="ios-input pl-10"
                  value={form.requiredDate}
                  onChange={(e) => updateFormHeader("requiredDate", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-[13px] font-semibold text-[#111827]">
                <FileSpreadsheet className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                物资明细 <span className="text-[#6B7280]">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="w-3.5 h-3.5" />
                  下载导入模板
                </button>
                <button
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  onClick={handleExcelImport}
                >
                  <Upload className="w-3.5 h-3.5" />
                  从Excel导入
                </button>
                <button
                  className="ios-btn ios-btn-primary ios-btn-sm"
                  onClick={addLineItem}
                >
                  <Plus className="w-3.5 h-3.5" />
                  添加行
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-[#E5E7EB] rounded-xl">
              <table className="w-full text-[13px]">
                <thead className="bg-[#F9FAFB]">
                  <tr>
                    <th className="py-2 px-2 text-center font-semibold text-[#6B7280] w-[44px]">序号</th>
                    <th className="py-2 px-2 text-left font-semibold text-[#111827] min-w-[120px]">物资名称<span className="text-[#6B7280] ml-0.5">*</span></th>
                    <th className="py-2 px-2 text-left font-semibold text-[#111827] min-w-[100px]">规格型号</th>
                    <th className="py-2 px-2 text-left font-semibold text-[#111827] min-w-[60px]">材质</th>
                    <th className="py-2 px-2 text-left font-semibold text-[#111827] min-w-[80px]">品牌</th>
                    <th className="py-2 px-2 text-left font-semibold text-[#111827] min-w-[90px]">适用标准号</th>
                    <th className="py-2 px-2 text-left font-semibold text-[#111827] min-w-[60px]">单位</th>
                    <th className="py-2 px-2 text-left font-semibold text-[#111827] min-w-[70px]">数量</th>
                    <th className="py-2 px-2 text-left font-semibold text-[#111827] min-w-[80px]">备注</th>
                    <th className="py-2 px-2 text-center font-semibold text-[#6B7280] w-[44px]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, index) => (
                    <tr key={index} className="border-t border-[#F3F4F6] hover:bg-[#FFFFFF]">
                      <td className="py-1.5 px-2 text-center text-[#6B7280]">{index + 1}</td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          className="ios-input py-1.5 px-2 text-[13px] w-full min-w-[100px]"
                          placeholder="物资名称"
                          value={item.materialName}
                          onChange={(e) => updateFormItem(index, "materialName", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          className="ios-input py-1.5 px-2 text-[13px] w-full min-w-[80px]"
                          placeholder="规格型号"
                          value={item.spec}
                          onChange={(e) => updateFormItem(index, "spec", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          className="ios-input py-1.5 px-2 text-[13px] w-full min-w-[50px]"
                          placeholder="材质"
                          value={item.material}
                          onChange={(e) => updateFormItem(index, "material", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          className="ios-input py-1.5 px-2 text-[13px] w-full min-w-[60px]"
                          placeholder="品牌"
                          value={item.brand}
                          onChange={(e) => updateFormItem(index, "brand", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          className="ios-input py-1.5 px-2 text-[13px] w-full min-w-[80px]"
                          placeholder="标准号"
                          value={item.standardNo}
                          onChange={(e) => updateFormItem(index, "standardNo", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          className="ios-input py-1.5 px-2 text-[13px] w-full min-w-[50px]"
                          placeholder="单位"
                          value={item.unit}
                          onChange={(e) => updateFormItem(index, "unit", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          step="0.01"
                          className="ios-input py-1.5 px-2 text-[13px] w-full min-w-[60px]"
                          placeholder="数量"
                          value={item.quantity}
                          onChange={(e) => updateFormItem(index, "quantity", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          className="ios-input py-1.5 px-2 text-[13px] w-full min-w-[70px]"
                          placeholder="备注"
                          value={item.remark}
                          onChange={(e) => updateFormItem(index, "remark", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <button
                          className="w-6 h-6 rounded-full bg-[#6B7280]/10 hover:bg-[#6B7280]/20 flex items-center justify-center transition-colors mx-auto"
                          onClick={() => removeLineItem(index)}
                          disabled={form.items.length <= 1}
                        >
                          <X className="w-3 h-3 text-[#6B7280]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold text-[#111827]">
                <Paperclip className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                附件
              </label>
              <button
                className="ios-btn ios-btn-secondary ios-btn-sm"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.rar";
                  input.onchange = (e) => handleFileUpload(e as any);
                  input.click();
                }}
                disabled={uploadingFile}
              >
                <Upload className="w-3.5 h-3.5" />
                {uploadingFile ? "上传中..." : "上传附件"}
              </button>
            </div>
            {form.attachments.length > 0 ? (
              <div className="space-y-1.5">
                {form.attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#F9FAFB]">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <File className="w-3.5 h-3.5 text-[#6B7280] flex-shrink-0" />
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#111827] truncate hover:underline">{att.name}</a>
                    </div>
                    <button className="w-6 h-6 rounded-full hover:bg-[#E5E7EB] flex items-center justify-center flex-shrink-0" onClick={() => handleRemoveAttachment(idx)}>
                      <X className="w-3 h-3 text-[#6B7280]" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-[#6B7280] text-center py-3">暂无附件</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F3F4F6]">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowModal(false)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "保存中..." : editingRecord ? "保存修改" : "创建需求"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="确认删除"
        maxWidth="400px"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#6B7280]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#6B7280]" />
          </div>
          <p className="text-[15px] text-[#111827] mb-1">
            确定要删除采购需求 <span className="font-semibold">{deleteConfirm?.requestNo}</span> 吗？
          </p>
          <p className="text-[13px] text-[#6B7280] mb-6">此操作不可撤销</p>
          <div className="flex justify-center gap-3">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setDeleteConfirm(null)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailRecord}
        onClose={() => { setDetailRecord(null); setApprovalInstance(null); }}
        title="采购需求详情"
        maxWidth="860px"
      >
        {detailRecord && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[12px] text-[#6B7280] mb-1">计划单号</label>
                <p className="text-[15px] font-mono font-semibold text-[#111827]">{detailRecord.requestNo}</p>
              </div>
              <div>
                <label className="block text-[12px] text-[#6B7280] mb-1">项目源ID</label>
                <p className="text-[15px] font-mono">{detailRecord.projectSourceId}</p>
              </div>
              <div>
                <label className="block text-[12px] text-[#6B7280] mb-1">项目名称</label>
                <p className="text-[15px] font-semibold">{detailRecord.project?.name || "-"}</p>
              </div>
              <div>
                <label className="block text-[12px] text-[#6B7280] mb-1">需求日期</label>
                <p className="text-[15px]">{formatDate(detailRecord.requiredDate)}</p>
              </div>
              <div>
                <label className="block text-[12px] text-[#6B7280] mb-1">状态</label>
                <span className={`ios-badge ${statusColorMap[detailRecord.status] || "ios-badge-gray"}`}>
                  {detailRecord.status}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-[13px] font-semibold text-[#111827] mb-3">
                <Package className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                物资明细（{detailRecord.items?.length || 0} 项）
              </label>
              <div className="overflow-x-auto border border-[#E5E7EB] rounded-xl">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#F9FAFB]">
                    <tr>
                      <th className="py-2 px-3 text-center font-semibold text-[#6B7280] w-[44px]">序号</th>
                      <th className="py-2 px-3 text-left font-semibold text-[#111827]">物资名称</th>
                      <th className="py-2 px-3 text-left font-semibold text-[#111827]">规格型号</th>
                      <th className="py-2 px-3 text-left font-semibold text-[#111827]">材质</th>
                      <th className="py-2 px-3 text-left font-semibold text-[#111827]">品牌</th>
                      <th className="py-2 px-3 text-left font-semibold text-[#111827]">适用标准号</th>
                      <th className="py-2 px-3 text-left font-semibold text-[#111827]">单位</th>
                      <th className="py-2 px-3 text-left font-semibold text-[#111827]">数量</th>
                      <th className="py-2 px-3 text-left font-semibold text-[#111827]">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailRecord.items || [])
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((item, index) => (
                        <tr key={item.id} className="border-t border-[#F3F4F6]">
                          <td className="py-2 px-3 text-center text-[#6B7280]">{index + 1}</td>
                          <td className="py-2 px-3 font-semibold">{item.materialName}</td>
                          <td className="py-2 px-3">{item.spec || "-"}</td>
                          <td className="py-2 px-3">{item.material || "-"}</td>
                          <td className="py-2 px-3">{item.brand || "-"}</td>
                          <td className="py-2 px-3">{item.standardNo || "-"}</td>
                          <td className="py-2 px-3">{item.unit || "-"}</td>
                          <td className="py-2 px-3 font-mono">{item.quantity || "-"}</td>
                          <td className="py-2 px-3 text-[#6B7280]">{item.remark || "-"}</td>
                        </tr>
                      ))}
                    {(!detailRecord.items || detailRecord.items.length === 0) && (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-[#6B7280]">
                          暂无物资明细
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {detailRecord.inquiry && (
              <div className="p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <p className="text-[13px] font-semibold text-[#111827] mb-2">已关联询价单</p>
                <a href="/procurement/inquiries" className="text-[13px] text-[#111827] hover:underline">
                  点击查看询价详情 →
                </a>
              </div>
            )}

            {detailRecord.attachments && Array.isArray(detailRecord.attachments) && detailRecord.attachments.length > 0 && (
              <div>
                <label className="block text-[13px] font-semibold text-[#111827] mb-2">
                  <Paperclip className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  附件 ({detailRecord.attachments.length})
                </label>
                <div className="space-y-1.5">
                  {detailRecord.attachments.map((att: { name: string; url: string }, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-[#F9FAFB]">
                      <File className="w-3.5 h-3.5 text-[#6B7280]" />
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#111827] hover:underline">{att.name}</a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ApprovalTimeline instance={approvalInstance} loading={approvalLoading} />

            <div className="flex justify-end gap-3 pt-4 border-t border-[#F3F4F6]">
              <button
                className="ios-btn ios-btn-secondary"
                onClick={() => { setDetailRecord(null); setApprovalInstance(null); }}
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
