"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, Eye, Pencil, Trash2, FileText, ChevronRight, Building2, User, Upload, FileCheck, X } from "lucide-react";
import Modal from "@/components/Modal";
import { ContractChangeOrderDetailCard } from "@/components/detail-cards";
import { DetailPageLayout } from "@/components/DetailPageLayout";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";
import { getRowStatusClass } from "@/lib/status-colors";

interface ChangeOrder {
  id: string;
  changeNo: string;
  contractType: string;
  contractId: string;
  changeReason: string;
  previousAmount: string;
  newAmount: string;
  amountDifference: string;
  status: string;
  approvalInstanceId: string | null;
  createdAt: string;
}

export default function ChangeOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<ChangeOrder[]>([]);
  const { page, pageSize, pagination, setPage, setPageSize, setPagination } = usePagination();
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  // 查看弹窗状态
  const [showDetail, setShowDetail] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 新建/编辑弹窗状态
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [fetchingContract, setFetchingContract] = useState(false);
  const [originalContract, setOriginalContract] = useState<any>(null);

  // 归档弹窗状态
  const [archiveOrder, setArchiveOrder] = useState<any>(null);
  const [archiveFiles, setArchiveFiles] = useState<string[]>([]);
  const [archiveUploading, setArchiveUploading] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const archiveFileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    contractType: "",
    contractId: "",
    changeReason: "",
    previousAmount: "",
    newAmount: "",
    newFiles: [] as string[],
    remark: "",
  });

  const contractTypeLabel: Record<string, string> = {
    income_contract: "收入合同",
    expense_contract: "支出合同",
    inter_org_contract: "内部结算",
  };

  const statusColor: Record<string, string> = {
    "草稿": "ios-badge-gray",
    "待审批": "ios-badge-yellow",
    "已批准": "ios-badge-blue",
    "待归档": "ios-badge-purple",
    "已归档": "ios-badge-green",
    "已生效": "ios-badge-green",
    "已驳回": "ios-badge-red",
  };

  const fetchOrders = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterType) params.set("contractType", filterType);
    params.set("page", page.toString());
    params.set("pageSize", pageSize.toString());

    const res = await fetch(`/api/change-orders?${params}`);
    const json = await res.json();
    setOrders(json.data || []);
    if (json.pagination) setPagination(json.pagination);
    setLoading(false);
  }, [filterStatus, filterType, page, pageSize]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // 处理从 URL 传入的 contractType/contractId 参数（从合同详情页跳转过来）
  useEffect(() => {
    const ct = searchParams.get("contractType") || "";
    const ci = searchParams.get("contractId") || "";
    const edit = searchParams.get("edit") || "";
    if (edit) {
      handleOpenEdit(edit);
    } else if (ct && ci) {
      handleOpenCreate(ct, ci);
    }
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除此变更单？")) return;
    await fetch(`/api/change-orders/${id}`, { method: "DELETE" });
    fetchOrders();
  };

  const handleSubmitApproval = async (order: ChangeOrder) => {
    const res = await fetch("/api/approval-instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessType: "contract_change_order",
        businessId: order.id,
        businessTitle: order.changeReason,
        flowLevel: "common",
      }),
    });
    if (res.ok) {
      fetchOrders();
    } else {
      const json = await res.json();
      alert(json.error || "提交审批失败");
    }
  };

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "0";
    return num.toLocaleString("zh-CN");
  };

  const formatAmountYuan = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "¥0.00";
    return `¥${num.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("zh-CN");
  };

  // ========== 查看弹窗 ==========
  const handleOpenDetail = async (id: string) => {
    setShowDetail(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/change-orders/${id}`);
      const json = await res.json();
      setDetailOrder(json.data);
    } catch (err) {
      console.error("获取变更单详情失败:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  // ========== 新建/编辑弹窗 ==========
  const resetForm = () => {
    setEditingId("");
    setForm({
      contractType: "",
      contractId: "",
      changeReason: "",
      previousAmount: "",
      newAmount: "",
      newFiles: [],
      remark: "",
    });
    setOriginalContract(null);
  };

  const fetchOriginalContract = async (type: string, cId: string) => {
    if (!type || !cId) return;
    setFetchingContract(true);
    const apiMap: Record<string, string> = {
      income_contract: `/api/income-contracts/${cId}`,
      expense_contract: `/api/expense-contracts/${cId}`,
      inter_org_contract: `/api/inter-org-contracts/${cId}`,
    };
    const url = apiMap[type];
    if (!url) { setFetchingContract(false); return; }

    try {
      const res = await fetch(url);
      const json = await res.json();
      const contract = json.data || json;
      setOriginalContract(contract);
      if (!editingId) {
        setForm((prev) => ({
          ...prev,
          previousAmount: contract.totalAmount?.toString() || contract.settlementAmount?.toString() || "0",
          newAmount: contract.totalAmount?.toString() || contract.settlementAmount?.toString() || "0",
        }));
      }
    } catch (err) {
      console.error("获取原合同失败:", err);
    } finally {
      setFetchingContract(false);
    }
  };

  const handleOpenCreate = (contractType?: string, contractId?: string) => {
    resetForm();
    if (contractType && contractId) {
      setForm((prev) => ({ ...prev, contractType, contractId }));
      fetchOriginalContract(contractType, contractId);
    }
    setShowForm(true);
  };

  const handleOpenEdit = async (id: string) => {
    resetForm();
    try {
      const res = await fetch(`/api/change-orders/${id}`);
      const json = await res.json();
      if (json.data) {
        const order = json.data;
        setEditingId(id);
        setForm({
          contractType: order.contractType,
          contractId: order.contractId,
          changeReason: order.changeReason || "",
          previousAmount: String(order.previousAmount || ""),
          newAmount: String(order.newAmount || ""),
          newFiles: Array.isArray(order.newFiles) ? order.newFiles : [],
          remark: order.remark || "",
        });
        fetchOriginalContract(order.contractType, order.contractId);
        setShowForm(true);
      }
    } catch (err) {
      console.error("获取变更单失败:", err);
    }
  };

  const handleFormSubmit = async () => {
    if (!form.changeReason.trim()) {
      alert("请输入变更原因");
      return;
    }
    if (!form.newAmount || parseFloat(form.newAmount) <= 0) {
      alert("请输入有效的变更后金额");
      return;
    }

    setFormSaving(true);
    try {
      const isEdit = !!editingId;
      const url = isEdit ? `/api/change-orders/${editingId}` : "/api/change-orders";
      const method = isEdit ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        contractType: form.contractType,
        contractId: form.contractId,
        changeReason: form.changeReason,
        previousAmount: form.previousAmount,
        newAmount: form.newAmount,
        newFiles: form.newFiles,
        remark: form.remark,
      };

      const previousData = originalContract ? {
        contractNo: originalContract.contractNo,
        contractName: originalContract.contractName,
        paymentTerms: originalContract.paymentTerms || "",
        pricingMethod: originalContract.pricingMethod || "",
        taxRate: originalContract.taxRate?.toString() || "",
        contractSummary: originalContract.contractSummary || "",
      } : {};
      body.previousData = previousData;
      body.newData = previousData;

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        setShowForm(false);
        resetForm();
        fetchOrders();
      } else {
        const json = await res.json();
        alert(json.error || "操作失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setFormSaving(false);
    }
  };

  const contractTypeOptions = [
    { value: "", label: "请选择" },
    { value: "income_contract", label: "收入合同" },
    { value: "expense_contract", label: "支出合同" },
    { value: "inter_org_contract", label: "内部结算合同" },
  ];

  const formDiff =
    form.previousAmount && form.newAmount
      ? parseFloat(form.newAmount) - parseFloat(form.previousAmount)
      : 0;

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>合同变更</h1>
            <p>管理合同变更单，变更合同金额和其他信息</p>
          </div>
          <button
            className="ios-btn ios-btn-primary"
            onClick={() => handleOpenCreate()}
          >
            <Plus className="w-4 h-4" />
            新建变更单
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
              placeholder="搜索变更单号..."
              value=""
              readOnly
            />
          </div>

          <select
            className="ios-select w-[160px]"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">全部类型</option>
            {Object.entries(contractTypeLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            className="ios-select w-[140px]"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">全部状态</option>
            {["草稿", "待审批", "已批准", "待归档", "已归档", "已生效", "已驳回"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <FileText className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>暂无变更单，点击右上角新建</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>变更单号</th>
                  <th>合同类型</th>
                  <th>原金额</th>
                  <th>新金额</th>
                  <th>差额</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className={getRowStatusClass(o.status)}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-[#1C1917]" />
                        </div>
                        <span className="font-semibold">{o.changeNo}</span>
                      </div>
                    </td>
                    <td>{contractTypeLabel[o.contractType] || o.contractType}</td>
                    <td className="font-semibold">{formatAmount(o.previousAmount || "0")}</td>
                    <td className="font-semibold">{formatAmount(o.newAmount || "0")}</td>
                    <td className={`font-semibold ${parseFloat(o.amountDifference) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {parseFloat(o.amountDifference) >= 0 ? "+" : ""}{formatAmount(o.amountDifference || "0")}
                    </td>
                    <td>
                      <span className={`ios-badge ${statusColor[o.status] || "ios-badge-gray"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenDetail(o.id)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          查看
                        </button>
                        {(o.status === "草稿" || o.status === "已驳回") && (
                          <>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => handleOpenEdit(o.id)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              编辑
                            </button>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                              onClick={() => handleDelete(o.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              删除
                            </button>
                          </>
                        )}
                        {o.status === "草稿" && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                            onClick={() => handleSubmitApproval(o)}
                          >
                            提交审批
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                        {(o.status === "已批准" || o.status === "待归档") && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={async () => {
                              const res = await fetch(`/api/change-orders/${o.id}`);
                              const json = await res.json();
                              setArchiveOrder(json.data);
                              setArchiveFiles(json.data?.newFiles || []);
                            }}
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            归档
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

      {/* ========== 查看弹窗 ========== */}
      <Modal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        title="变更单详情"
        maxWidth="640px"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : detailOrder ? (
          <DetailPageLayout
            title={detailOrder.changeNo}
            instanceId={detailOrder.approvalInstanceId}
            businessType="contract_change_order"
            businessId={detailOrder.id}
          >
            <ContractChangeOrderDetailCard data={detailOrder} />

            {/* 关联合同 */}
            {detailOrder.relatedContract && (
              <div>
                <h3 className="text-[14px] font-bold text-[#1C1917] mb-3">关联合同</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <p className="text-[12px] text-[#78716C] mb-0.5">合同编号</p>
                    <p className="text-[14px] font-semibold text-[#1C1917]">
                      {detailOrder.relatedContract.contractNo || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#78716C] mb-0.5">
                      {detailOrder.contractType === "income_contract"
                        ? "客户"
                        : detailOrder.contractType === "expense_contract"
                          ? "供应商"
                          : "收款方"}
                    </p>
                    <p className="text-[14px] text-[#1C1917] flex items-center gap-1.5">
                      {detailOrder.contractType === "inter_org_contract" ? (
                        <>
                          <Building2 className="w-3.5 h-3.5 text-[#78716C]" />
                          {detailOrder.relatedContract.fromOrg?.name || "-"}
                        </>
                      ) : (
                        <>
                          <User className="w-3.5 h-3.5 text-[#78716C]" />
                          {detailOrder.relatedContract.customer?.name ||
                            detailOrder.relatedContract.supplier?.name ||
                            "-"}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  className="mt-3 text-[13px] text-[#1C1917] hover:underline flex items-center gap-1"
                  onClick={() => {
                    setShowDetail(false);
                    const pathMap: Record<string, string> = {
                      income_contract: `/contracts/income`,
                      expense_contract: `/contracts/expense`,
                      inter_org_contract: `/contracts/internal-settlement/${detailOrder.contractId}`,
                    };
                    router.push(pathMap[detailOrder.contractType] || "#");
                  }}
                >
                  查看原合同
                </button>
              </div>
            )}

            {/* 超收标记 */}
            {detailOrder.hasOverCollection && (
              <div className="bg-yellow-50 p-3 rounded-xl">
                <h3 className="text-[14px] font-bold text-yellow-800 mb-2">
                  ⚠️ 超收提醒
                </h3>
                <p className="text-[14px] text-yellow-800">
                  已收金额超过变更后合同金额，超收：
                  {formatAmountYuan(detailOrder.overCollectionAmount || "0")}
                </p>
              </div>
            )}
          </DetailPageLayout>
        ) : (
          <div className="text-center py-10 text-[#78716C]">
            <FileText className="w-8 h-8 mx-auto mb-2" />
            <p>未找到变更单信息</p>
          </div>
        )}
      </Modal>

      {/* ========== 新建/编辑弹窗 ========== */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title={editingId ? "编辑变更单" : "新建变更单"}
        maxWidth="600px"
      >
        <div className="space-y-4">
          {/* 合同类型和合同编号 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                合同类型 <span className="text-[#78716C]">*</span>
              </label>
              <select
                className="ios-select w-full"
                value={form.contractType}
                onChange={(e) => {
                  setForm((f) => ({ ...f, contractType: e.target.value, contractId: "" }));
                  setOriginalContract(null);
                }}
                disabled={!!editingId}
              >
                {contractTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                合同编号
              </label>
              <input
                type="text"
                className="ios-input w-full"
                value={form.contractId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contractId: e.target.value }))
                }
                placeholder="输入合同ID或编号"
                disabled={!!editingId}
                onBlur={() => {
                  if (form.contractType && form.contractId && !originalContract) {
                    fetchOriginalContract(form.contractType, form.contractId);
                  }
                }}
              />
            </div>
          </div>

          {/* 原合同信息 */}
          {fetchingContract && (
            <div className="p-3 rounded-xl bg-[#FAFAF9] text-[13px] text-[#78716C]">
              <div className="w-4 h-4 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin inline-block mr-2" />
              加载原合同信息...
            </div>
          )}

          {originalContract && (
            <div className="p-3 rounded-xl bg-[#FAFAF9]">
              <h3 className="text-[13px] font-semibold text-[#1C1917] mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#78716C]" />
                原合同信息
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                <div>
                  <span className="text-[#78716C]">合同编号：</span>
                  <span className="text-[#1C1917] font-medium">
                    {originalContract.contractNo || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[#78716C]">客户/供应商：</span>
                  <span className="text-[#1C1917] font-medium">
                    {originalContract.customer?.name ||
                      originalContract.supplier?.name ||
                      "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[#78716C]">原金额：</span>
                  <span className="text-[#1C1917] font-semibold">
                    {formatAmount(form.previousAmount || "0")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 金额变更 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                原合同金额
              </label>
              <input
                type="text"
                className="ios-input w-full bg-[#FAFAF9]"
                value={formatAmount(form.previousAmount || "0")}
                readOnly
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                变更后金额 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="ios-input w-full"
                value={form.newAmount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, newAmount: e.target.value }))
                }
              />
              {form.previousAmount && form.newAmount && (
                <p
                  className={`text-xs mt-1 ${
                    formDiff >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  差额：{formDiff >= 0 ? "+" : ""}
                  {formDiff.toLocaleString("zh-CN")}
                </p>
              )}
            </div>
          </div>

          {/* 变更原因 */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              变更原因 <span className="text-[#78716C]">*</span>
            </label>
            <textarea
              className="ios-input w-full min-h-[80px] resize-none"
              rows={3}
              value={form.changeReason}
              onChange={(e) =>
                setForm((f) => ({ ...f, changeReason: e.target.value }))
              }
              placeholder="请填写变更原因"
            />
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              备注
            </label>
            <textarea
              className="ios-input w-full min-h-[60px] resize-none"
              rows={2}
              value={form.remark}
              onChange={(e) =>
                setForm((f) => ({ ...f, remark: e.target.value }))
              }
              placeholder="备注信息（可选）"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => { setShowForm(false); resetForm(); }}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleFormSubmit}
              disabled={formSaving}
            >
              {formSaving ? "提交中..." : editingId ? "保存修改" : "保存"}
            </button>
          </div>
        </div>
      </Modal>

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

      {/* ==================== 归档弹窗（文件可选） ==================== */}
      <Modal
        isOpen={!!archiveOrder}
        onClose={() => setArchiveOrder(null)}
        title="变更单归档"
        maxWidth="480px"
      >
        {archiveOrder && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#FAFAF9]">
              <p className="text-[13px] text-[#78716C] mb-1">变更单号</p>
              <p className="text-[15px] font-bold text-[#1C1917]">{archiveOrder.changeNo}</p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                上传合同扫描件（可选）
              </label>
              {archiveFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {archiveFiles.map((url: string, idx: number) => (
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
                {archiveUploading ? "上传中..." : "选择合同扫描件上传（可选）"}
              </button>
              <p className="text-[12px] text-[#78716C] mt-1">
                如有新的合同文件可上传，无新文件可直接确认归档
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="ios-btn ios-btn-secondary"
                onClick={() => setArchiveOrder(null)}
              >
                取消
              </button>
              <button
                className="ios-btn !bg-[#1C1917] !text-white text-sm hover:!bg-[#0066DD] disabled:opacity-50 flex items-center gap-1"
                disabled={archiveSaving}
                onClick={async () => {
                  setArchiveSaving(true);
                  try {
                    // 查找审批实例，执行归档 action
                    const instanceRes = await fetch(`/api/approval-instances?businessType=contract_change_order&businessId=${archiveOrder.id}`);
                    const instanceJson = await instanceRes.json();
                    const instances = instanceJson.data || instanceJson;
                    const activeInstance = Array.isArray(instances)
                      ? instances.find((inst: any) => inst.status === "审批中" || inst.status === "待归档")
                      : null;

                    if (activeInstance) {
                      // 通过审批引擎执行归档
                      const res = await fetch(`/api/approval-instances/${activeInstance.id}/actions`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "archive",
                          archivedUrl: archiveFiles.length > 0 ? JSON.stringify(archiveFiles) : null,
                        }),
                      });
                      if (res.ok) {
                        setArchiveOrder(null);
                        fetchOrders();
                      } else {
                        const json = await res.json();
                        alert(json.error || "归档失败");
                      }
                    } else {
                      // 无活跃审批实例，直接更新状态
                      const res = await fetch(`/api/change-orders/${archiveOrder.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          status: "已生效",
                          archivedUrl: archiveFiles.length > 0 ? JSON.stringify(archiveFiles) : undefined,
                        }),
                      });
                      if (res.ok) {
                        setArchiveOrder(null);
                        fetchOrders();
                      } else {
                        const json = await res.json();
                        alert(json.error || "归档失败");
                      }
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
