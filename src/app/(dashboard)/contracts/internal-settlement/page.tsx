"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  FileText,
  Building2,
  Eye,
  Pencil,
  Trash2,
  ChevronRight,
  Save,
  X,
  User,
  FileCheck,
  Receipt,
  CreditCard,
  Upload,
} from "lucide-react";
import Modal from "@/components/Modal";
import { InterOrgContractDetailCard } from '@/components/detail-cards';
import { DetailPageLayout } from "@/components/DetailPageLayout";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";
import { getRowStatusClass } from "@/lib/status-colors";

/* ==================== 类型定义 ==================== */

interface Organization {
  id: string;
  name: string;
}

interface IncomeContract {
  id: string;
  contractNo: string;
  projectSourceId: string | null;
  interOrgContractId: string | null;
  totalAmount: string;
  status: string;
  signedDate?: string | null;
  createdAt: string;
  customer?: { id: string; name: string };
  project?: { id: string; name: string; projectSourceId: string } | null;
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
  approvalInstanceId: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  fromOrg: Organization;
  toOrg: Organization;
}

interface RelatedContract {
  id: string;
  contractNo: string;
  totalAmount: string;
  customer?: { id: string; name: string } | null;
  project?: { id: string; name: string; projectSourceId: string } | null;
}

interface ReceiptVoucher {
  id: string;
  voucherNo: string;
  amount: string;
  voucherDate: string;
  [key: string]: unknown;
}

interface Receivable {
  id: string;
  receivableNo: string;
  amount: string;
  status: string;
  dueDate: string;
  receiptVouchers: ReceiptVoucher[];
  [key: string]: unknown;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceCode: string;
  invoiceType: string;
  amount: string;
  invoiceDate: string;
  [key: string]: unknown;
}

// 查看弹窗用到的扩展类型
interface ViewContract extends InterOrgContract {
  archivedUrl: string | null;
  relatedContract?: RelatedContract | null;
  receivables?: Receivable[];
  invoices?: Invoice[];
}

interface FormData {
  contractNo: string;
  contractName: string;
  fromOrgId: string;
  toOrgId: string;
  relatedContractId: string;
  mainContractAmount: string;
  managementFee: string;
  taxBurden: string;
  otherFee: string;
  otherFeeNote: string;
  settlementAmount: string;
  remark: string;
}

/* ==================== 常量 ==================== */

const emptyForm: FormData = {
  contractNo: "",
  contractName: "",
  fromOrgId: "",
  toOrgId: "",
  relatedContractId: "",
  mainContractAmount: "",
  managementFee: "",
  taxBurden: "0",
  otherFee: "0",
  otherFeeNote: "",
  settlementAmount: "",
  remark: "",
};

const statusBadgeMap: Record<string, string> = {
  草稿: "ios-badge-gray",
  审批中: "ios-badge-blue",
  已批准: "ios-badge-green",
  已驳回: "ios-badge-red",
  合同归档: "ios-badge-gray",
};

const getStatusBadge = (status: string) =>
  `ios-badge ${statusBadgeMap[status] || "ios-badge-gray"}`;

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDateFull = (dateStr: string | null) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const parseArchivedFiles = (archivedUrl: string | null): string[] => {
  if (!archivedUrl) return [];
  try {
    const parsed = JSON.parse(archivedUrl);
    return Array.isArray(parsed) ? parsed : [archivedUrl];
  } catch {
    return [archivedUrl];
  }
};

const calcSettlementAmount = (
  main: string,
  mgmt: string,
  tax: string,
  other: string
) => {
  const mainNum = parseFloat(main) || 0;
  const mgmtNum = parseFloat(mgmt) || 0;
  const taxNum = parseFloat(tax) || 0;
  const otherNum = parseFloat(other) || 0;
  return (mainNum - mgmtNum - taxNum - otherNum).toFixed(2);
};

const getIncomeContractStatusBadge = (status: string) => {
  const map: Record<string, string> = {
    已批准:
      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800",
    已归档:
      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800",
    草稿:
      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600",
    已驳回:
      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-800",
    审批中:
      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-100 text-yellow-800",
  };
  return (
    map[status] ||
    "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600"
  );
};

/* ==================== 主组件 ==================== */

export default function InternalSettlementPage() {
  const router = useRouter();
  // ── 列表状态 ──
  const [contracts, setContracts] = useState<InterOrgContract[]>([]);
  const { page, pageSize, pagination, setPage, setPageSize, setPagination } = usePagination();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<InterOrgContract | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  // ── 查看弹窗状态 ──
  const [viewContract, setViewContract] = useState<ViewContract | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // ── 新建/编辑弹窗状态 ──
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingContractId, setEditingContractId] = useState<string | null>(
    null
  ); // null = 新建
  const [form, setForm] = useState<FormData>(emptyForm);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [incomeContracts, setIncomeContracts] = useState<IncomeContract[]>([]);
  const [showContractPicker, setShowContractPicker] = useState(false);
  const [contractSearch, setContractSearch] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // ── 归档状态 ──
  const [archiveContract, setArchiveContract] = useState<InterOrgContract | null>(null);
  const [archiveFiles, setArchiveFiles] = useState<string[]>([]);
  const [archiveUploading, setArchiveUploading] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const archiveFileRef = useRef<HTMLInputElement>(null);

  // ── 计算属性 ──
  const selectedContract = incomeContracts.find(
    (c) => c.id === form.relatedContractId
  );

  // 可选收入合同：创建模式排除已关联的，编辑模式允许当前关联的
  const eligibleContracts = editingContractId
    ? incomeContracts.filter(
        (c) => !c.interOrgContractId || c.interOrgContractId === editingContractId
      )
    : incomeContracts.filter((c) => !c.interOrgContractId);

  const filteredPickerContracts = eligibleContracts.filter((c) => {
    if (!contractSearch.trim()) return true;
    const kw = contractSearch.toLowerCase();
    return (
      c.contractNo.toLowerCase().includes(kw) ||
      c.customer?.name?.toLowerCase().includes(kw) ||
      c.project?.name?.toLowerCase().includes(kw)
    );
  });

  const otherFeeNum = parseFloat(form.otherFee) || 0;

  /* ==================== 数据获取 ==================== */

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      if (search) params.set("search", search);
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());

      const res = await fetch(`/api/inter-org-contracts?${params}`);
      const json = await res.json();

      if (res.ok) {
        setContracts(json.data || []);
        if (json.pagination) setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取内部结算合同列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterStatus, page, pageSize]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // 预加载组织列表和收入合同（用于表单弹窗）
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/bank-accounts?pageSize=200");
        if (res.ok) {
          const json = await res.json();
          // 从银行账户中筛选公司账户，作为所属主体数据源
          const companyAccounts = (json.data || []).filter((a: any) => a.accountType === "公司账户");
          setOrganizations(companyAccounts);
        }
      } catch {
        setOrganizations([]);
      }
      try {
        const res = await fetch("/api/income-contracts?pageSize=500");
        if (res.ok) {
          const json = await res.json();
          const all = json.data || [];
          setIncomeContracts(
            all.filter(
              (c: IncomeContract) => c.projectSourceId
            )
          );
        }
      } catch {
        setIncomeContracts([]);
      }
    };
    fetchData();
  }, []);

  /* ==================== 查看弹窗 ==================== */

  const handleOpenView = async (contract: InterOrgContract) => {
    setViewLoading(true);
    // 先用列表数据展示基本信息
    setViewContract({ ...contract, archivedUrl: null } as ViewContract);
    try {
      const res = await fetch(`/api/inter-org-contracts/${contract.id}`);
      if (res.ok) {
        const json = await res.json();
        setViewContract(json.data);
      }
    } catch (err) {
      console.error("获取合同详情失败:", err);
    } finally {
      setViewLoading(false);
    }
  };

  /* ==================== 新建/编辑弹窗 ==================== */

  const updateForm = (field: keyof FormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (
        field === "mainContractAmount" ||
        field === "managementFee" ||
        field === "taxBurden" ||
        field === "otherFee"
      ) {
        next.settlementAmount = calcSettlementAmount(
          field === "mainContractAmount" ? value : next.mainContractAmount,
          field === "managementFee" ? value : next.managementFee,
          field === "taxBurden" ? value : next.taxBurden,
          field === "otherFee" ? value : next.otherFee
        );
      }
      return next;
    });
    if (formError) setFormError("");
  };

  const handleRelatedContractChange = async (contractId: string) => {
    updateForm("relatedContractId", contractId);
    if (!contractId) {
      updateForm("mainContractAmount", "");
      return;
    }
    try {
      const res = await fetch(`/api/income-contracts/${contractId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          updateForm("mainContractAmount", String(json.data.totalAmount || ""));
        }
      }
    } catch {
      // 静默
    }
  };

  const handleOpenNew = () => {
    setEditingContractId(null);
    setForm(emptyForm);
    setFormError("");
    setShowFormModal(true);
  };

  const handleOpenEdit = (contract: InterOrgContract) => {
    setEditingContractId(contract.id);
    setForm({
      contractNo: contract.contractNo,
      contractName: contract.contractName,
      fromOrgId: contract.fromOrgId,
      toOrgId: contract.toOrgId,
      relatedContractId: contract.relatedContractId || "",
      mainContractAmount: contract.mainContractAmount || "",
      managementFee: contract.managementFee,
      taxBurden: contract.taxBurden,
      otherFee: contract.otherFee,
      otherFeeNote: contract.otherFeeNote || "",
      settlementAmount: contract.settlementAmount,
      remark: contract.remark || "",
    });
    setFormError("");
    setShowFormModal(true);
  };

  const handleFormSubmit = async () => {
    if (!form.contractNo.trim()) {
      setFormError("合同编号不能为空");
      return;
    }
    if (!form.contractName.trim()) {
      setFormError("合同名称不能为空");
      return;
    }
    if (!form.fromOrgId) {
      setFormError("请选择收款方");
      return;
    }
    if (!form.toOrgId) {
      setFormError("请选择付款方");
      return;
    }
    if (!form.managementFee || parseFloat(form.managementFee) < 0) {
      setFormError("管理费不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        contractNo: form.contractNo.trim(),
        contractName: form.contractName.trim(),
        fromOrgId: form.fromOrgId,
        toOrgId: form.toOrgId,
        type: "MANAGEMENT_FEE",
        relatedContractId: form.relatedContractId || null,
        mainContractAmount: form.mainContractAmount || null,
        managementFee: form.managementFee || "0",
        taxBurden: form.taxBurden || "0",
        otherFee: form.otherFee || "0",
        otherFeeNote: form.otherFeeNote || null,
        settlementAmount: form.settlementAmount || "0",
        remark: form.remark || null,
      };

      let res: Response;
      if (editingContractId) {
        res = await fetch(`/api/inter-org-contracts/${editingContractId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/inter-org-contracts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();

      if (res.ok) {
        setShowFormModal(false);
        fetchContracts();
      } else {
        setFormError(json.error || (editingContractId ? "保存失败" : "创建失败"));
      }
    } catch {
      setFormError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  /* ==================== 删除 ==================== */

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/inter-org-contracts/${deleteTarget.id}`,
        { method: "DELETE" }
      );
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

  /* ==================== 提交审批 ==================== */

  const handleSubmitApproval = async (contract: InterOrgContract) => {
    try {
      const res = await fetch("/api/approval-instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        businessType: "inter_org_contract",
        businessId: contract.id,
        businessTitle: contract.contractName,
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

  /* ==================== 渲染 ==================== */

  return (
    <>
      {/* 页头 */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>内部结算合同</h1>
            <p>管理内部组织间管理费结算合同</p>
          </div>
          <button
            className="ios-btn ios-btn-primary"
            onClick={handleOpenNew}
          >
            <Plus className="w-4 h-4" />
            新建
          </button>
        </div>
      </div>

      {/* 筛选栏 + 列表 */}
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
              {pagination?.total ?? 0}
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
                  <tr key={contract.id} className={getRowStatusClass(contract.status)}>
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
                      <span className="block text-[11px]">
                        {formatDateFull(contract.updatedAt)}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {/* 查看 - 所有状态 */}
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenView(contract)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          查看
                        </button>
                        {/* 编辑 + 删除 + 提交审批 - 草稿/已驳回 */}
                        {(contract.status === "草稿" ||
                          contract.status === "已驳回") && (
                          <>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => handleOpenEdit(contract)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              编辑
                            </button>
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
                        {/* 合同归档 - 已批准状态下 */}
                        {contract.status === "已批准" && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => {
                              setArchiveContract(contract);
                              setArchiveFiles([]);
                            }}
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            合同归档
                          </button>
                        )}
                        {/* 发起变更 - 合同归档状态下 */}
                        {contract.status === "合同归档" && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                            onClick={() => router.push(`/contracts/change-orders/new?contractType=inter_org_contract&contractId=${contract.id}`)}
                          >
                            发起变更
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <PaginationBar
              pagination={pagination}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {/* ==================== 查看弹窗（纯只读） ==================== */}
      <Modal
        isOpen={!!viewContract}
        onClose={() => setViewContract(null)}
        title={viewContract?.contractName || "合同详情"}
        maxWidth="720px"
      >
        {viewLoading && (
          <div className="flex items-center justify-center py-4 mb-4">
            <div className="w-6 h-6 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {viewContract && (
          <DetailPageLayout
            title={viewContract.contractName}
            instanceId={viewContract.approvalInstanceId}
            businessType="inter_org_contract"
            businessId={viewContract.id}
          >
            {/* 状态标签 */}
            <div className="flex items-center gap-2">
              <span className={getStatusBadge(viewContract.status)}>
                {viewContract.status}
              </span>
              <span className="text-[12px] text-[#78716C]">
                {viewContract.contractNo}
              </span>
            </div>

            <InterOrgContractDetailCard data={viewContract} />

            {/* 4. 收款记录 */}
            {(viewContract.receivables?.length ?? 0) > 0 && (
              <div>
                <h4 className="text-[13px] font-bold text-[#1C1917] mb-3">
                  收款记录 ({viewContract.receivables!.length})
                </h4>
                <div className="space-y-3">
                  {viewContract.receivables!.map((rec) => (
                    <div key={rec.id} className="p-3 rounded-xl bg-[#FAFAF9]">
                      <div className="grid grid-cols-3 gap-3 mb-2">
                        <div>
                          <p className="text-[11px] text-[#78716C]">应收编号</p>
                          <p className="text-[13px] font-semibold text-[#1C1917]">
                            {rec.receivableNo || rec.id}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-[#78716C]">应收金额</p>
                          <p className="text-[13px] font-semibold text-[#1C1917]">
                            {formatAmount(rec.amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-[#78716C]">到期日</p>
                          <p className="text-[13px] text-[#1C1917]">
                            {formatDate(rec.dueDate)}
                          </p>
                        </div>
                      </div>
                      {rec.receiptVouchers && rec.receiptVouchers.length > 0 && (
                        <div className="pt-2 border-t border-[#E7E5E4]">
                          <p className="text-[11px] text-[#78716C] mb-2">
                            收款凭证
                          </p>
                          <div className="space-y-1.5">
                            {rec.receiptVouchers.map((v) => (
                              <div
                                key={v.id}
                                className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white"
                              >
                                <div className="flex items-center gap-2">
                                  <CreditCard className="w-3.5 h-3.5 text-[#78716C]" />
                                  <span className="text-[13px] text-[#1C1917]">
                                    {v.voucherNo || v.id}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[12px] text-[#78716C]">
                                    {formatDate(v.voucherDate)}
                                  </span>
                                  <span className="text-[13px] font-semibold text-[#1C1917]">
                                    {formatAmount(v.amount)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. 发票记录 */}
            <div>
              <h4 className="text-[13px] font-bold text-[#1C1917] mb-3">
                发票记录 ({viewContract.invoices?.length ?? 0})
              </h4>
              {(!viewContract.invoices || viewContract.invoices.length === 0) ? (
                <p className="text-[13px] text-[#78716C]">暂无发票记录</p>
              ) : (
                <div className="space-y-2">
                  {viewContract.invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#FAFAF9]"
                    >
                      <div className="flex items-center gap-3">
                        <Receipt className="w-4 h-4 text-[#78716C]" />
                        <div>
                          <p className="text-[13px] font-semibold text-[#1C1917]">
                            {inv.invoiceNo || inv.invoiceCode || "发票"}
                          </p>
                          <p className="text-[11px] text-[#78716C]">
                            {inv.invoiceType} · {formatDate(inv.invoiceDate)}
                          </p>
                        </div>
                      </div>
                      <span className="text-[13px] font-semibold text-[#1C1917]">
                        {formatAmount(inv.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. 归档文件 */}
            {parseArchivedFiles(viewContract.archivedUrl).length > 0 && (
              <div>
                <h4 className="text-[13px] font-bold text-[#1C1917] mb-3">
                  归档文件
                </h4>
                <div className="flex flex-wrap gap-2">
                  {parseArchivedFiles(viewContract.archivedUrl).map(
                    (url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[12px] text-[#1C1917] hover:underline"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
                        {url.split("/").pop() || `文件${idx + 1}`}
                      </a>
                    )
                  )}
                </div>
              </div>
            )}
          </DetailPageLayout>
        )}
      </Modal>

      {/* ==================== 新建/编辑弹窗 ==================== */}
      <Modal
        isOpen={showFormModal}
        onClose={() => !saving && setShowFormModal(false)}
        title={editingContractId ? "编辑合同" : "新建内部结算合同"}
        maxWidth="640px"
      >
        <div className="max-h-[60vh] overflow-y-auto space-y-5 pr-1">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {formError}
            </div>
          )}

          {/* 1. 基本信息 */}
          <div>
            <h4 className="text-[13px] font-bold text-[#1C1917] mb-3">
              基本信息
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  合同编号 <span className="text-[#78716C]">*</span>
                </label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="请输入合同编号"
                  value={form.contractNo}
                  onChange={(e) => updateForm("contractNo", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  合同名称 <span className="text-[#78716C]">*</span>
                </label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="请输入合同名称"
                  value={form.contractName}
                  onChange={(e) => updateForm("contractName", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  收款方 <span className="text-[#78716C]">*</span>
                </label>
                <select
                  className="ios-select"
                  value={form.fromOrgId}
                  onChange={(e) => updateForm("fromOrgId", e.target.value)}
                >
                  <option value="">请选择收款方</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  付款方 <span className="text-[#78716C]">*</span>
                </label>
                <select
                  className="ios-select"
                  value={form.toOrgId}
                  onChange={(e) => updateForm("toOrgId", e.target.value)}
                >
                  <option value="">请选择付款方</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. 关联主合同 */}
          <div>
            <h4 className="text-[13px] font-bold text-[#1C1917] mb-3">
              关联主合同
            </h4>

            {selectedContract ? (
              <div className="flex items-center justify-between p-3 rounded-lg border border-[#E7E5E4] bg-[#FAFAF9]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1C1917]/8 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-[#1C1917]" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#1C1917]">
                      {selectedContract.contractNo}
                      {selectedContract.customer
                        ? ` - ${selectedContract.customer.name}`
                        : ""}
                    </div>
                    <div className="text-[12px] text-[#78716C] mt-0.5">
                      {selectedContract.project?.name || "无关联项目"}
                      {" · "}
                      {formatAmount(selectedContract.totalAmount)}
                      {" · "}
                      {selectedContract.status}
                    </div>
                  </div>
                </div>
                <button
                  className="text-[12px] text-[#78716C] hover:text-red-600 transition-colors flex items-center gap-1"
                  onClick={() => handleRelatedContractChange("")}
                >
                  <X className="w-3 h-3" />
                  取消
                </button>
              </div>
            ) : (
              <button
                className="ios-btn ios-btn-secondary flex items-center gap-2"
                onClick={() => {
                  setContractSearch("");
                  setShowContractPicker(true);
                }}
              >
                <Search className="w-4 h-4" />
                选择关联合同
              </button>
            )}

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  主合同金额
                </label>
                <input
                  type="text"
                  className="ios-input bg-[#FAFAF9]"
                  value={
                    form.mainContractAmount
                      ? `¥${parseFloat(form.mainContractAmount).toLocaleString("zh-CN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : ""
                  }
                  placeholder="选择收入合同后自动带出"
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* 合同选择弹窗（嵌套在表单 Modal 中） */}
          {showContractPicker && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setShowContractPicker(false)}
              />
              <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[700px] mx-4">
                <h3 className="text-[16px] font-bold text-[#1C1917] mb-4">
                  选择关联合同
                </h3>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                    <input
                      type="text"
                      className="ios-input pl-9"
                      placeholder="搜索合同编号、客户名称、项目名称..."
                      value={contractSearch}
                      onChange={(e) => setContractSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="border border-[#E7E5E4] rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto">
                    <table className="ios-table">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr>
                          <th>合同编号</th>
                          <th>客户</th>
                          <th>项目</th>
                          <th>金额</th>
                          <th>状态</th>
                          <th>签约日期</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPickerContracts.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="text-center text-[#78716C] py-8 text-[13px]"
                            >
                              {contractSearch
                                ? "无匹配的合同"
                                : "暂无可关联的收入合同"}
                            </td>
                          </tr>
                        ) : (
                          filteredPickerContracts.map((c) => {
                            const isSelected =
                              form.relatedContractId === c.id;
                            return (
                              <tr
                                key={c.id}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? "bg-[#1C1917]/8"
                                    : "hover:bg-[#F5F5F4]"
                                }`}
                                onClick={() => {
                                  handleRelatedContractChange(c.id);
                                  setShowContractPicker(false);
                                }}
                              >
                                <td>
                                  <span className="font-semibold text-[13px]">
                                    {c.contractNo}
                                  </span>
                                </td>
                                <td>
                                  <div className="flex items-center gap-1.5 text-[13px]">
                                    <Building2 className="w-3 h-3 text-[#78716C]" />
                                    {c.customer?.name || "-"}
                                  </div>
                                </td>
                                <td className="text-[13px] text-[#78716C]">
                                  {c.project?.name || "-"}
                                </td>
                                <td className="font-semibold text-[13px]">
                                  {formatAmount(c.totalAmount)}
                                </td>
                                <td>
                                  <span
                                    className={getIncomeContractStatusBadge(
                                      c.status
                                    )}
                                  >
                                    {c.status}
                                  </span>
                                </td>
                                <td className="text-[12px] text-[#78716C]">
                                  {formatDate(
                                    c.signedDate || c.createdAt
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-[12px] text-[#78716C] text-right">
                    共 {filteredPickerContracts.length} 个合同
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    className="ios-btn ios-btn-secondary"
                    onClick={() => setShowContractPicker(false)}
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. 费用信息 */}
          <div>
            <h4 className="text-[13px] font-bold text-[#1C1917] mb-3">
              费用信息
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  管理费 <span className="text-[#78716C]">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="ios-input"
                  placeholder="请输入管理费金额"
                  value={form.managementFee}
                  onChange={(e) => updateForm("managementFee", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  税费承担
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="ios-input"
                  placeholder="请输入税费承担金额，默认0"
                  value={form.taxBurden}
                  onChange={(e) => updateForm("taxBurden", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  其他费用
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="ios-input"
                  placeholder="请输入其他费用，默认0"
                  value={form.otherFee}
                  onChange={(e) => updateForm("otherFee", e.target.value)}
                />
              </div>
              {otherFeeNum > 0 && (
                <div>
                  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                    其他费用说明 <span className="text-[#78716C]">*</span>
                  </label>
                  <input
                    type="text"
                    className="ios-input"
                    placeholder="请说明其他费用用途"
                    value={form.otherFeeNote}
                    onChange={(e) => updateForm("otherFeeNote", e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  结算合同额
                </label>
                <input
                  type="text"
                  className="ios-input bg-[#FAFAF9] font-bold"
                  value={
                    form.settlementAmount
                      ? `¥${parseFloat(form.settlementAmount).toLocaleString("zh-CN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : "¥0.00"
                  }
                  readOnly
                />
                <p className="text-[11px] text-[#78716C] mt-1">
                  = 主合同金额 - 管理费 - 税费承担 - 其他费用
                </p>
              </div>
            </div>
          </div>

          {/* 4. 备注 */}
          <div>
            <h4 className="text-[13px] font-bold text-[#1C1917] mb-3">备注</h4>
            <textarea
              className="ios-input min-h-[80px] resize-none"
              placeholder="请输入备注信息（可选）"
              value={form.remark}
              onChange={(e) => updateForm("remark", e.target.value)}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowFormModal(false)}
              disabled={saving}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleFormSubmit}
              disabled={saving}
            >
              <Save className="w-4 h-4" />
              {saving
                ? "保存中..."
                : editingContractId
                  ? "保存修改"
                  : "创建合同"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== 删除确认弹窗 ==================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[400px] mx-4">
            <h3 className="text-[16px] font-bold text-[#1C1917] mb-2">
              确认删除
            </h3>
            <p className="text-[13px] text-[#78716C] mb-6">
              确定要删除合同 &quot;{deleteTarget.contractNo}&quot;
              吗？此操作不可撤销。
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

      {/* ==================== 隐藏文件上传 ==================== */}
      <input
        type="file"
        ref={archiveFileRef}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setArchiveUploading(true);
          try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            });
            if (res.ok) {
              const json = await res.json();
              if (json.url) {
                setArchiveFiles((prev) => [...prev, json.url]);
              }
            }
          } catch {
            // 上传失败
          } finally {
            setArchiveUploading(false);
            if (archiveFileRef.current) archiveFileRef.current.value = "";
          }
        }}
      />

      {/* ==================== 归档弹窗 ==================== */}
      <Modal
        isOpen={!!archiveContract}
        onClose={() => setArchiveContract(null)}
        title="合同归档"
        maxWidth="480px"
      >
        {archiveContract && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#FAFAF9]">
              <p className="text-[13px] text-[#78716C] mb-1">合同编号</p>
              <p className="text-[15px] font-bold text-[#1C1917]">{archiveContract.contractNo}</p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                上传盖章扫描件 <span className="text-[#78716C]">*</span>
              </label>
              {archiveFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {archiveFiles.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[12px]">
                      <FileCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#1C1917] hover:underline truncate max-w-[150px]">
                        {url.split("/").pop() || `文件${idx + 1}`}
                      </a>
                      <button
                        type="button"
                        className="text-[#78716C] hover:text-[#78716C]"
                        onClick={() => setArchiveFiles((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="ios-btn ios-btn-secondary w-full"
                disabled={archiveUploading}
                onClick={() => archiveFileRef.current?.click()}
              >
                <Upload className="w-4 h-4" />
                {archiveUploading ? "上传中..." : "选择盖章扫描件上传"}
              </button>
              <p className="text-[12px] text-[#78716C] mt-1">
                支持 PDF、JPG、PNG 格式，至少上传1个文件
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="ios-btn ios-btn-secondary"
                onClick={() => setArchiveContract(null)}
              >
                取消
              </button>
              <button
                className="ios-btn !bg-[#1C1917] !text-white text-sm hover:!bg-[#0066DD] disabled:opacity-50 flex items-center gap-1"
                disabled={archiveFiles.length === 0 || archiveSaving}
                onClick={async () => {
                  if (archiveFiles.length === 0) {
                    alert("请上传至少1个盖章扫描件");
                    return;
                  }
                  setArchiveSaving(true);
                  try {
                    const res = await fetch(`/api/inter-org-contracts/${archiveContract.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        status: "合同归档",
                        archivedUrl: JSON.stringify(archiveFiles),
                      }),
                    });
                    if (res.ok) {
                      setArchiveContract(null);
                      fetchContracts();
                    } else {
                      const json = await res.json();
                      alert(json.error || "归档失败");
                    }
                  } catch {
                    alert("网络错误");
                  } finally {
                    setArchiveSaving(false);
                  }
                }}
              >
                {archiveSaving ? "归档中..." : "确认归档"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
