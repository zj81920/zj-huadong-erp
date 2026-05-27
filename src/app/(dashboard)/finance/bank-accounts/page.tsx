"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Landmark,
  Building2,
} from "lucide-react";
import Modal from "@/components/Modal";

interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNo: string;
  accountType: string;
  remark: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BankAccountFormData {
  accountName: string;
  bankName: string;
  accountNo: string;
  accountType: string;
  remark: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyForm: BankAccountFormData = {
  accountName: "",
  bankName: "",
  accountNo: "",
  accountType: "公司账户",
  remark: "",
};

const accountTypeOptions = [
  { value: "公司账户", label: "公司账户" },
  { value: "个人账户", label: "个人账户" },
];

function maskAccountNo(accountNo: string): string {
  if (accountNo.length <= 4) return accountNo;
  return "****" + accountNo.slice(-4);
}

export default function BankAccountsPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterAccountType, setFilterAccountType] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<BankAccount | null>(null);
  const [form, setForm] = useState<BankAccountFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<BankAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchBankAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterAccountType) params.set("accountType", filterAccountType);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/bank-accounts?${params}`);
      const json = await res.json();

      if (res.ok) {
        setBankAccounts(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取银行账户列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterAccountType, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchBankAccounts();
  }, [fetchBankAccounts]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (item: BankAccount) => {
    setEditingItem(item);
    setForm({
      accountName: item.accountName,
      bankName: item.bankName,
      accountNo: item.accountNo,
      accountType: item.accountType,
      remark: item.remark || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.accountName.trim()) {
      setFormError("账户名称不能为空");
      return;
    }
    if (!form.bankName.trim()) {
      setFormError("开户银行不能为空");
      return;
    }
    if (!form.accountNo.trim()) {
      setFormError("银行账号不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        accountName: form.accountName.trim(),
        bankName: form.bankName.trim(),
        accountNo: form.accountNo.trim(),
        accountType: form.accountType,
        remark: form.remark.trim() || null,
      };

      const url = editingItem
        ? `/api/bank-accounts/${editingItem.id}`
        : "/api/bank-accounts";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchBankAccounts();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: BankAccount) => {
    setTogglingId(item.id);
    try {
      const res = await fetch(`/api/bank-accounts/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });

      if (res.ok) {
        fetchBankAccounts();
      } else {
        const json = await res.json();
        alert(json.error || "操作失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/bank-accounts/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        fetchBankAccounts();
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

  const updateForm = (field: keyof BankAccountFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>银行账户管理</h1>
            <p>管理公司银行账户信息，支持启用停用控制</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增账户
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
              placeholder="搜索账户名称、开户银行..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <select
            className="ios-select w-[140px]"
            value={filterAccountType}
            onChange={(e) => {
              setFilterAccountType(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部类型</option>
            {accountTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
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
        ) : bankAccounts.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
              <Landmark className="w-8 h-8 text-[#86868B]" />
            </div>
            <p>{search || filterAccountType ? "没有匹配的银行账户" : "暂无银行账户，点击右上角新增"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>账户名称</th>
                  <th>开户银行</th>
                  <th>银行账号</th>
                  <th>账户类型</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {bankAccounts.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                          <Landmark className="w-4 h-4 text-[#007AFF]" />
                        </div>
                        <span className="font-semibold">{item.accountName}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#86868B]" />
                        {item.bankName}
                      </div>
                    </td>
                    <td className="font-mono text-[13px] text-[#86868B]">
                      {maskAccountNo(item.accountNo)}
                    </td>
                    <td>
                      <span className={`ios-badge ${item.accountType === "公司账户" ? "ios-badge-blue" : "ios-badge-green"}`}>
                        {item.accountType}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`ios-badge transition-colors duration-150 ${
                          item.isActive ? "ios-badge-green cursor-pointer" : "ios-badge-gray cursor-pointer"
                        } ${togglingId === item.id ? "opacity-50" : ""}`}
                        onClick={() => handleToggleActive(item)}
                        disabled={togglingId === item.id}
                      >
                        {togglingId === item.id ? "切换中..." : item.isActive ? "启用" : "停用"}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                          onClick={() => setDeleteConfirm(item)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
        title={editingItem ? "编辑银行账户" : "新增银行账户"}
        maxWidth="560px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                账户名称 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入账户名称"
                value={form.accountName}
                onChange={(e) => updateForm("accountName", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                开户银行 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入开户银行"
                value={form.bankName}
                onChange={(e) => updateForm("bankName", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                银行账号 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入银行账号"
                value={form.accountNo}
                onChange={(e) => updateForm("accountNo", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                账户类型
              </label>
              <select
                className="ios-select"
                value={form.accountType}
                onChange={(e) => updateForm("accountType", e.target.value)}
              >
                {accountTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">备注</label>
              <textarea
                className="ios-textarea"
                placeholder="备注信息（选填）"
                value={form.remark}
                onChange={(e) => updateForm("remark", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
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
              {saving ? "保存中..." : editingItem ? "保存修改" : "创建账户"}
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
          <div className="w-14 h-14 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#FF3B30]" />
          </div>
          <p className="text-[15px] text-[#1D1D1F] mb-1">
            确定要删除银行账户 <span className="font-semibold">{deleteConfirm?.accountName}</span> 吗？
          </p>
          <p className="text-[13px] text-[#86868B] mb-6">此操作不可撤销</p>
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
