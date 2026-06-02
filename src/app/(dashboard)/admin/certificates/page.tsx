"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Award,
  Eye,
  MapPin,
  FileText,
  Calendar,
  User,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Certificate {
  id: string;
  name: string;
  certNo: string | null;
  certType: string | null;
  issuer: string | null;
  issueDate: string | null;
  expireDate: string | null;
  holder: string | null;
  status: string;
  location: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
}

interface CertificateFormData {
  name: string;
  certNo: string;
  certType: string;
  issuer: string;
  issueDate: string;
  expireDate: string;
  holder: string;
  status: string;
  location: string;
  remark: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyForm: CertificateFormData = {
  name: "",
  certNo: "",
  certType: "",
  issuer: "",
  issueDate: "",
  expireDate: "",
  holder: "",
  status: "有效",
  location: "",
  remark: "",
};

const certTypeOptions = [
  { value: "营业执照", label: "营业执照" },
  { value: "资质证书", label: "资质证书" },
  { value: "安全生产许可证", label: "安全生产许可证" },
  { value: "行业资质", label: "行业资质" },
  { value: "其他", label: "其他" },
];

const statusOptions = [
  { value: "有效", label: "有效" },
  { value: "即将过期", label: "即将过期" },
  { value: "已过期", label: "已过期" },
  { value: "已注销", label: "已注销" },
];

const statusColorMap: Record<string, string> = {
  有效: "ios-badge-green",
  即将过期: "ios-badge-orange",
  已过期: "ios-badge-red",
  已注销: "ios-badge-gray",
};

const certTypeColorMap: Record<string, string> = {
  营业执照: "ios-badge-blue",
  资质证书: "ios-badge-green",
  安全生产许可证: "ios-badge-orange",
  行业资质: "ios-badge-purple",
  其他: "ios-badge-gray",
};

function computeStatus(expireDate: string | null, currentStatus: string): string {
  if (currentStatus === "已注销") return "已注销";
  if (!expireDate) return currentStatus;
  const now = new Date();
  const expire = new Date(expireDate);
  const diffDays = (expire.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "已过期";
  if (diffDays <= 30) return "即将过期";
  return "有效";
}

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCertType, setFilterCertType] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Certificate | null>(null);
  const [form, setForm] = useState<CertificateFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [detailItem, setDetailItem] = useState<Certificate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Certificate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [users, setUsers] = useState<{id: string; username: string; realName: string}[]>([]);

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      if (filterCertType) params.set("certType", filterCertType);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/certificates?${params}`);
      const json = await res.json();

      if (res.ok) {
        setCertificates(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取证照列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterCertType, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchCertificates();
    fetch("/api/settings/users").then(res => res.json()).then(json => setUsers(json.data || []));
  }, [fetchCertificates]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (item: Certificate) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      certNo: item.certNo || "",
      certType: item.certType || "",
      issuer: item.issuer || "",
      issueDate: item.issueDate ? item.issueDate.split("T")[0] : "",
      expireDate: item.expireDate ? item.expireDate.split("T")[0] : "",
      holder: item.holder || "",
      status: item.status,
      location: item.location || "",
      remark: item.remark || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError("证照名称不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        name: form.name.trim(),
        certNo: form.certNo.trim() || null,
        certType: form.certType || null,
        issuer: form.issuer.trim() || null,
        issueDate: form.issueDate || null,
        expireDate: form.expireDate || null,
        holder: form.holder.trim() || null,
        status: form.status,
        location: form.location.trim() || null,
        remark: form.remark.trim() || null,
      };

      const url = editingItem
        ? `/api/certificates/${editingItem.id}`
        : "/api/certificates";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchCertificates();
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
      const res = await fetch(`/api/certificates/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        fetchCertificates();
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

  const updateForm = (field: keyof CertificateFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
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
            <h1>证照管理</h1>
            <p>管理公司证照资质，跟踪有效期与存放位置</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增证照
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
              placeholder="搜索证照名称、证号..."
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
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            className="ios-select w-[160px]"
            value={filterCertType}
            onChange={(e) => {
              setFilterCertType(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部类型</option>
            {certTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div className="ml-auto text-[13px] text-[#78716C]">
            共 <span className="font-semibold text-[#1C1917]">{pagination.total}</span> 条记录
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : certificates.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <Award className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>{search || filterStatus || filterCertType ? "没有匹配的证照记录" : "暂无证照，点击右上角新增"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>证照名称</th>
                  <th>证号</th>
                  <th>类型</th>
                  <th>发证机关</th>
                  <th>发证日期</th>
                  <th>到期日期</th>
                  <th>持有人</th>
                  <th>状态</th>
                  <th>存放位置</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((item) => {
                  const displayStatus = computeStatus(item.expireDate, item.status);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                            <Award className="w-4 h-4 text-[#1C1917]" />
                          </div>
                          <span className="font-semibold">{item.name}</span>
                        </div>
                      </td>
                      <td className="text-[#78716C] font-mono text-[13px]">{item.certNo || "-"}</td>
                      <td>
                        {item.certType ? (
                          <span className={`ios-badge ${certTypeColorMap[item.certType] || "ios-badge-gray"}`}>
                            {item.certType}
                          </span>
                        ) : (
                          <span className="text-[#78716C]">-</span>
                        )}
                      </td>
                      <td>{item.issuer || "-"}</td>
                      <td className="text-[#78716C]">{formatDate(item.issueDate)}</td>
                      <td className="text-[#78716C]">{formatDate(item.expireDate)}</td>
                      <td>{users.find(u => u.id === item.holder)?.realName || item.holder || "-"}</td>
                      <td>
                        <span className={`ios-badge ${statusColorMap[displayStatus] || "ios-badge-gray"}`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td>{item.location || "-"}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => setDetailItem(item)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            详情
                          </button>
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            编辑
                          </button>
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                            onClick={() => setDeleteConfirm(item)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                          </button>
                        </div>
                      </td>
                      <td className="text-[#78716C] text-[12px] whitespace-nowrap">
                        {item.lastModifiedBy && (
                          <span>{item.lastModifiedBy}</span>
                        )}
                        <span className="block text-[11px]">{formatDate(item.updatedAt)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-[#F5F5F4]">
                <button
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  上一页
                </button>
                <span className="text-[13px] text-[#78716C] px-3">
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
        title={editingItem ? "编辑证照" : "新增证照"}
        maxWidth="600px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                证照名称 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入证照名称"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">证号</label>
              <input
                type="text"
                className="ios-input"
                placeholder="证照编号"
                value={form.certNo}
                onChange={(e) => updateForm("certNo", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">证照类型</label>
              <select
                className="ios-select"
                value={form.certType}
                onChange={(e) => updateForm("certType", e.target.value)}
              >
                <option value="">请选择</option>
                {certTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">发证机关</label>
              <input
                type="text"
                className="ios-input"
                placeholder="发证机关"
                value={form.issuer}
                onChange={(e) => updateForm("issuer", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">状态</label>
              <select
                className="ios-select"
                value={form.status}
                onChange={(e) => updateForm("status", e.target.value)}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">发证日期</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="date"
                  className="ios-input pl-10"
                  value={form.issueDate}
                  onChange={(e) => updateForm("issueDate", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">到期日期</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="date"
                  className="ios-input pl-10"
                  value={form.expireDate}
                  onChange={(e) => updateForm("expireDate", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">持有人</label>
              <select
                className="ios-select"
                value={form.holder}
                onChange={(e) => updateForm("holder", e.target.value)}
              >
                <option value="">请选择持有人</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.realName}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">存放位置</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="存放位置"
                  value={form.location}
                  onChange={(e) => updateForm("location", e.target.value)}
                />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">备注</label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-3 w-4 h-4 text-[#78716C]" />
                <textarea
                  className="ios-input pl-10 min-h-[80px] resize-none"
                  placeholder="备注信息"
                  value={form.remark}
                  onChange={(e) => updateForm("remark", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
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
              {saving ? "保存中..." : editingItem ? "保存修改" : "创建证照"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        title="证照详情"
        maxWidth="500px"
      >
        {detailItem && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <p className="text-[12px] text-[#78716C] mb-0.5">证照名称</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailItem.name}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">证号</p>
                <p className="text-[14px] text-[#1C1917] font-mono">{detailItem.certNo || "-"}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">证照类型</p>
                <p>{detailItem.certType ? (
                  <span className={`ios-badge ${certTypeColorMap[detailItem.certType] || "ios-badge-gray"}`}>
                    {detailItem.certType}
                  </span>
                ) : "-"}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">发证机关</p>
                <p className="text-[14px] text-[#1C1917]">{detailItem.issuer || "-"}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">状态</p>
                <p>
                  <span className={`ios-badge ${statusColorMap[computeStatus(detailItem.expireDate, detailItem.status)] || "ios-badge-gray"}`}>
                    {computeStatus(detailItem.expireDate, detailItem.status)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">发证日期</p>
                <p className="text-[14px] text-[#1C1917]">{formatDate(detailItem.issueDate)}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">到期日期</p>
                <p className="text-[14px] text-[#1C1917]">{formatDate(detailItem.expireDate)}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">持有人</p>
                <p className="text-[14px] text-[#1C1917]">{users.find(u => u.id === detailItem.holder)?.realName || detailItem.holder || "-"}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">存放位置</p>
                <p className="text-[14px] text-[#1C1917]">{detailItem.location || "-"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[12px] text-[#78716C] mb-0.5">备注</p>
                <p className="text-[14px] text-[#1C1917]">{detailItem.remark || "-"}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">创建时间</p>
                <p className="text-[14px] text-[#1C1917]">{formatDate(detailItem.createdAt)}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">更新时间</p>
                <p className="text-[14px] text-[#1C1917]">{formatDate(detailItem.updatedAt)}</p>
              </div>
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
          <div className="w-14 h-14 rounded-full bg-[#78716C]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#78716C]" />
          </div>
          <p className="text-[15px] text-[#1C1917] mb-1">
            确定要删除证照 <span className="font-semibold">{deleteConfirm?.name}</span> 吗？
          </p>
          <p className="text-[13px] text-[#78716C] mb-6">此操作不可撤销</p>
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
    </>
  );
}
