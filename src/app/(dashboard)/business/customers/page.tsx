"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Building2,
  Phone,
  Mail,
  MapPin,
  Users,
} from "lucide-react";
import Modal from "@/components/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";
import { getUserModulePerms } from "@/lib/types/permissions";

interface Customer {
  id: string;
  name: string;
  address: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  maintainer: string | null;
  industryType: string | null;
  customerGrade: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  createdById: string | null;
}

interface CustomerFormData {
  name: string;
  address: string;
  contactPerson: string;
  phone: string;
  email: string;
  maintainer: string;
  industryType: string;
  customerGrade: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyForm: CustomerFormData = {
  name: "",
  address: "",
  contactPerson: "",
  phone: "",
  email: "",
  maintainer: "",
  industryType: "",
  customerGrade: "C",
};

const gradeColorMap: Record<string, string> = {
  A: "ios-badge-green",
  B: "ios-badge-blue",
  C: "ios-badge-gray",
};

const industryLabelMap: Record<string, string> = {
 石化: "ios-badge-orange",
  医药: "ios-badge-green",
};

export default function CustomersPage() {
  const { user } = useAuth();
  const rolePerms = getUserModulePerms(user, "customers");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterIndustry, setFilterIndustry] = useState("");
  const [filterGrade, setFilterGrade] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

  const { toggleSelect, selectAll, clearSelection, isAllSelected, selectedCount, isSelected } = useBatchSelection(customers.map((d) => d.id));

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterIndustry) params.set("industryType", filterIndustry);
      if (filterGrade) params.set("customerGrade", filterGrade);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/customers?${params}`);
      const json = await res.json();

      if (res.ok) {
        setCustomers(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取客户列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterIndustry, filterGrade, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      address: customer.address || "",
      contactPerson: customer.contactPerson || "",
      phone: customer.phone || "",
      email: customer.email || "",
      maintainer: customer.maintainer || "",
      industryType: customer.industryType || "",
      customerGrade: customer.customerGrade || "C",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError("客户名称不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingCustomer
        ? `/api/customers/${editingCustomer.id}`
        : "/api/customers";
      const method = editingCustomer ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchCustomers();
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
      const res = await fetch(`/api/customers/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        fetchCustomers();
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

  const updateForm = (field: keyof CustomerFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>客户管理</h1>
            <p>管理客户信息，包括石化、医药行业客户档案</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增客户
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
              placeholder="搜索客户名称、联系人、电话..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <select
            className="ios-select w-[140px]"
            value={filterIndustry}
            onChange={(e) => {
              setFilterIndustry(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部行业</option>
            <option value="石化">石化</option>
            <option value="医药">医药</option>
          </select>

          <select
            className="ios-select w-[140px]"
            value={filterGrade}
            onChange={(e) => {
              setFilterGrade(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部等级</option>
            <option value="A">A级</option>
            <option value="B">B级</option>
            <option value="C">C级</option>
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
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <Users className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>{search || filterIndustry || filterGrade ? "没有匹配的客户记录" : "暂无客户，点击右上角新增"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  {rolePerms.delete && <th className="w-10"><input type="checkbox" className="ios-checkbox" checked={isAllSelected} onChange={() => isAllSelected ? clearSelection() : selectAll()} /></th>}
                  <th>客户名称</th>
                  <th>行业类型</th>
                  <th>客户等级</th>
                  <th>联系人</th>
                  <th>电话</th>
                  <th>商务责任人</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className={isSelected(customer.id) ? "bg-[#1C1917]/5" : ""}>
                    {rolePerms.delete && <td className="w-10"><input type="checkbox" className="ios-checkbox" checked={isSelected(customer.id)} onChange={() => toggleSelect(customer.id)} /></td>}
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-[#1C1917]" />
                        </div>
                        <span className="font-semibold">{customer.name}</span>
                      </div>
                    </td>
                    <td>
                      {customer.industryType ? (
                        <span className={`ios-badge ${industryLabelMap[customer.industryType] || "ios-badge-gray"}`}>
                          {customer.industryType}
                        </span>
                      ) : (
                        <span className="text-[#78716C]">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`ios-badge ${gradeColorMap[customer.customerGrade || "C"]}`}>
                        {customer.customerGrade || "C"}级
                      </span>
                    </td>
                    <td>{customer.contactPerson || "-"}</td>
                    <td>
                      {customer.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-[#78716C]" />
                          {customer.phone}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{customer.maintainer || "-"}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                          onClick={() => setDetailCustomer(customer)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          详情
                        </button>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenEdit(customer)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                          onClick={() => setDeleteConfirm(customer)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          删除
                        </button>
                      </div>
                    </td>
                    <td className="text-[#78716C] text-[12px] whitespace-nowrap">
                      {customer.lastModifiedBy && (
                        <span>{customer.lastModifiedBy}</span>
                      )}
                      <span className="block text-[11px]">{formatDate(customer.updatedAt)}</span>
                    </td>
                  </tr>
                ))}
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

        {rolePerms.delete && <BatchDeleteBar businessType="customer" selectedIds={customers.filter(d => isSelected(d.id)).map(d => d.id)} onDeleteSuccess={fetchCustomers} onClear={clearSelection} />}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCustomer ? "编辑客户" : "新增客户"}
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
                客户名称 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入客户名称"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">行业类型</label>
              <select
                className="ios-select"
                value={form.industryType}
                onChange={(e) => updateForm("industryType", e.target.value)}
              >
                <option value="">请选择</option>
                <option value="石化">石化</option>
                <option value="医药">医药</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">客户等级</label>
              <select
                className="ios-select"
                value={form.customerGrade}
                onChange={(e) => updateForm("customerGrade", e.target.value)}
              >
                <option value="A">A级（重要客户）</option>
                <option value="B">B级（普通客户）</option>
                <option value="C">C级（潜在客户）</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">联系人</label>
              <div className="relative">
                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="联系人姓名"
                  value={form.contactPerson}
                  onChange={(e) => updateForm("contactPerson", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">电话</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="联系电话"
                  value={form.phone}
                  onChange={(e) => updateForm("phone", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="email"
                  className="ios-input pl-10"
                  placeholder="邮箱地址"
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">商务责任人</label>
              <input
                type="text"
                className="ios-input"
                placeholder="负责商务的人员"
                value={form.maintainer}
                onChange={(e) => updateForm("maintainer", e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">地址</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-[#78716C]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="客户地址"
                  value={form.address}
                  onChange={(e) => updateForm("address", e.target.value)}
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
              {saving ? "保存中..." : editingCustomer ? "保存修改" : "创建客户"}
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
          <div className="w-14 h-14 rounded-full bg-[#78716C]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#78716C]" />
          </div>
          <p className="text-[15px] text-[#1C1917] mb-1">
            确定要删除客户 <span className="font-semibold">{deleteConfirm?.name}</span> 吗？
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

      <Modal
        isOpen={!!detailCustomer}
        onClose={() => setDetailCustomer(null)}
        title="客户详情"
        maxWidth="600px"
      >
        {detailCustomer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">客户名称</p>
                <p className="text-[14px] font-semibold">{detailCustomer.name}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">行业类型</p>
                <p className="text-[14px] font-semibold">{detailCustomer.industryType || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">客户等级</p>
                <span className={`ios-badge ${gradeColorMap[detailCustomer.customerGrade || "C"]}`}>
                  {detailCustomer.customerGrade || "C"}级
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">商务责任人</p>
                <p className="text-[14px] font-semibold">{detailCustomer.maintainer || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">联系人</p>
                <p className="text-[14px] font-semibold">{detailCustomer.contactPerson || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">电话</p>
                <p className="text-[14px] font-semibold">{detailCustomer.phone || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">邮箱</p>
                <p className="text-[14px] font-semibold">{detailCustomer.email || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">地址</p>
                <p className="text-[14px] font-semibold">{detailCustomer.address || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">创建时间</p>
                <p className="text-[14px] font-semibold">{formatDate(detailCustomer.createdAt)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">最后修改</p>
                <p className="text-[14px] font-semibold">
                  {detailCustomer.lastModifiedBy ? `${detailCustomer.lastModifiedBy} · ${formatDate(detailCustomer.updatedAt)}` : formatDate(detailCustomer.updatedAt)}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
