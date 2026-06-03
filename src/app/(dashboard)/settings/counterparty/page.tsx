"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Search, Loader2, AlertCircle, Building2 } from "lucide-react";
import Modal from "@/components/Modal";
import { useAuth } from "@/contexts/AuthContext";

interface CounterpartyRecord {
  id: string;
  name: string;
  bankName: string | null;
  bankAccount: string | null;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = { name: "", bankName: "", bankAccount: "" };

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const maskAccount = (account: string | null) => {
  if (!account) return "-";
  if (account.length <= 4) return account;
  return `****${account.slice(-4)}`;
};

export default function CounterpartyPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.some((r: any) => r.code === "admin");

  const [records, setRecords] = useState<CounterpartyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("pageSize", "200");
      const res = await fetch(`/api/counterparty?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setRecords(json.data || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError("交易对方名称不能为空");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/counterparty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          bankName: form.bankName || null,
          bankAccount: form.bankAccount || null,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        fetchRecords();
      } else {
        const json = await res.json();
        setFormError(json.error || "保存失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此往来信息？")) return;
    try {
      await fetch(`/api/counterparty?id=${id}`, { method: "DELETE" });
      fetchRecords();
    } catch {
      alert("删除失败");
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-[#78716C] mx-auto mb-3" />
          <p className="text-[#78716C] text-[15px] font-medium">仅管理员可访问</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>往来信息管理</h1>
            <p>管理交易对方的开户行及银行账号信息</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="relative flex-1 min-w-[200px] max-w-[360px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
          <input
            type="text"
            className="ios-input pl-10"
            placeholder="搜索交易对方、开户行、银行账号..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bento-card-static">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#78716C] animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-[#78716C] text-[14px]">
            {search ? "未找到匹配的往来信息" : "暂无往来信息记录"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>交易对方</th>
                  <th>开户行</th>
                  <th>银行账号</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-[#78716C]" />
                        <span className="font-semibold text-[#1C1917]">{r.name}</span>
                      </div>
                    </td>
                    <td className="text-[#78716C]">{r.bankName || "-"}</td>
                    <td className="font-mono text-[13px]">{maskAccount(r.bankAccount)}</td>
                    <td className="text-[#78716C] text-[13px]">{formatDate(r.createdAt)}</td>
                    <td>
                      <button
                        className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="新增往来信息"
        maxWidth="480px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">{formError}</div>
          )}
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">交易对方名称 <span className="text-[#78716C]">*</span></label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入交易对方名称"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">开户行</label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入开户行"
              value={form.bankName}
              onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">银行账号</label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入银行账号"
              value={form.bankAccount}
              onChange={(e) => setForm((p) => ({ ...p, bankAccount: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
