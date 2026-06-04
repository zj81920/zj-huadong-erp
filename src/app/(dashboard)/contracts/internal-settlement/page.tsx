"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  FileText,
  Building2,
  Eye,
  Pencil,
  Trash2,
  ChevronRight,
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
}

interface InterOrgContract {
  id: string;
  contractNo: string;
  contractName: string;
  fromOrgId: string;
  toOrgId: string;
  type: string;
  relatedContractId: string | null;
  mainContractAmount: string | null;
  managementFee: string;
  taxBurden: string;
  otherFee: string;
  otherFeeNote: string | null;
  settlementAmount: string;
  status: string;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  fromOrg: Organization;
  toOrg: Organization;
}

const statusBadgeMap: Record<string, string> = {
  "草稿": "ios-badge-gray",
  "审批中": "ios-badge-blue",
  "已批准": "ios-badge-green",
  "已驳回": "ios-badge-red",
  "合同归档": "ios-badge-gray",
};

export default function InternalSettlementPage() {
  const [contracts, setContracts] = useState<InterOrgContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<InterOrgContract | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 编辑弹窗
  const [editingContract, setEditingContract] = useState<InterOrgContract | null>(null);
  const [editForm, setEditForm] = useState({
    contractNo: "",
    contractName: "",
    remark: "",
  });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/inter-org-contracts?${params}`);
      const json = await res.json();

      if (res.ok) {
        let data: InterOrgContract[] = json.data || [];
        if (search) {
          const q = search.toLowerCase();
          data = data.filter(
            (c) =>
              c.contractNo.toLowerCase().includes(q) ||
              c.contractName.toLowerCase().includes(q)
          );
        }
        setContracts(data);
      }
    } catch (err) {
      console.error("获取内部结算合同列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterStatus]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "¥0.00";
    return `¥${num.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const getStatusBadge = (status: string) => {
    return `ios-badge ${statusBadgeMap[status] || "ios-badge-gray"}`;
  };

  // 打开编辑弹窗
  const handleOpenEdit = (contract: InterOrgContract) => {
    setEditingContract(contract);
    setEditForm({
      contractNo: contract.contractNo,
      contractName: contract.contractName,
      remark: contract.remark || "",
    });
    setEditError("");
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editForm.contractNo.trim()) {
      setEditError("合同编号不能为空");
      return;
    }
    if (!editForm.contractName.trim()) {
      setEditError("合同名称不能为空");
      return;
    }
    if (!editingContract) return;

    setSaving(true);
    setEditError("");

    try {
      const res = await fetch(`/api/inter-org-contracts/${editingContract.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractNo: editForm.contractNo.trim(),
          contractName: editForm.contractName.trim(),
          remark: editForm.remark || null,
          status: editingContract.status,
        }),
      });

      if (res.ok) {
        setEditingContract(null);
        fetchContracts();
      } else {
        const json = await res.json();
        setEditError(json.error || "保存失败");
      }
    } catch {
      setEditError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  // 删除
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/inter-org-contracts/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        fetchContracts();
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setDeleting(false);
    }
  };

  // 提交审批
  const handleSubmitApproval = async (contract: InterOrgContract) => {
    try {
      const res = await fetch("/api/approval-instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: "inter_org_contract",
          businessId: contract.id,
          flowLevel: "common",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        fetchContracts();
      } else {
        alert(json.error || "提交审批失败");
      }
    } catch {
      alert("网络错误，请重试");
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>内部结算合同</h1>
            <p>管理内部组织间管理费结算合同</p>
          </div>
          <Link href="/contracts/internal-settlement/new">
            <button className="ios-btn ios-btn-primary">
              <Plus className="w-4 h-4" />
              新建
            </button>
          </Link>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索合同编号/名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="ios-select w-[140px]"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">全部类型</option>
            <option value="MANAGEMENT_FEE">管理费</option>
          </select>

          <select
            className="ios-select w-[140px]"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="草稿">草稿</option>
            <option value="审批中">审批中</option>
            <option value="已批准">已批准</option>
            <option value="已驳回">已驳回</option>
            <option value="合同归档">合同归档</option>
          </select>

          <div className="ml-auto text-[13px] text-[#78716C]">
            共{" "}
            <span className="font-semibold text-[#1C1917]">
              {contracts.length}
            </span>{" "}
            条记录
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : contracts.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <FileText className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>
              {search || filterType || filterStatus
                ? "没有匹配的合同记录"
                : "暂无合同，点击右上角新建"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>合同编号</th>
                  <th>合同名称</th>
                  <th>收款方</th>
                  <th>付款方</th>
                  <th>结算额</th>
                  <th>状态</th>
                  <th>最后修改时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-[#1C1917]" />
                        </div>
                        <span className="font-semibold">
                          {contract.contractNo}
                        </span>
                      </div>
                    </td>
                    <td className="font-medium">{contract.contractName}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#78716C]" />
                        {contract.fromOrg.name}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#78716C]" />
                        {contract.toOrg.name}
                      </div>
                    </td>
                    <td className="font-semibold">
                      {formatAmount(contract.settlementAmount)}
                    </td>
                    <td>
                      <span className={getStatusBadge(contract.status)}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="text-[#78716C] text-[12px] whitespace-nowrap">
                      {contract.lastModifiedBy && (
                        <span>{contract.lastModifiedBy}</span>
                      )}
                      <span className="block text-[11px]">{formatDate(contract.updatedAt)}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Link href={`/contracts/internal-settlement/${contract.id}`}>
                          <button className="ios-btn ios-btn-ghost ios-btn-sm">
                            <Eye className="w-3.5 h-3.5" />
                            查看
                          </button>
                        </Link>
                        {(contract.status === "草稿" || contract.status === "已驳回") && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => handleOpenEdit(contract)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            编辑
                          </button>
                        )}
                        {contract.status === "草稿" && (
                          <>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                              onClick={() => setDeleteTarget(contract)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              删除
                            </button>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                              onClick={() => handleSubmitApproval(contract)}
                            >
                              提交审批
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      {editingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setEditingContract(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[480px] mx-4">
            <h3 className="text-[16px] font-bold text-[#1C1917] mb-4">编辑合同</h3>
            {editError && (
              <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium mb-4">
                {editError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  合同编号 <span className="text-[#78716C]">*</span>
                </label>
                <input
                  type="text"
                  className="ios-input"
                  value={editForm.contractNo}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, contractNo: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  合同名称 <span className="text-[#78716C]">*</span>
                </label>
                <input
                  type="text"
                  className="ios-input"
                  value={editForm.contractName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, contractName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  备注
                </label>
                <textarea
                  className="ios-input min-h-[60px] resize-none"
                  value={editForm.remark}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, remark: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                className="ios-btn ios-btn-secondary"
                onClick={() => setEditingContract(null)}
                disabled={saving}
              >
                取消
              </button>
              <button
                className="ios-btn ios-btn-primary"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[400px] mx-4">
            <h3 className="text-[16px] font-bold text-[#1C1917] mb-2">确认删除</h3>
            <p className="text-[13px] text-[#78716C] mb-6">
              确定要删除合同 &quot;{deleteTarget.contractNo}&quot; 吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="ios-btn ios-btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                取消
              </button>
              <button
                className="ios-btn ios-btn-primary"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
