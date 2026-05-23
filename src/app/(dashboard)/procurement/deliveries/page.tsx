"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Eye,
  Truck,
  CheckCircle2,
  XCircle,
  FileCheck,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
}

interface PurchaseContract {
  id: string;
  contractNo: string;
  supplierId: string;
  totalAmount: number;
  status: string;
  supplier: Supplier;
}

interface DeliveryReceipt {
  id: string;
  purchaseContractId: string;
  deliveryDate: string;
  receivedQuantity: string;
  inspectionResult: string;
  receiptStatus: string;
  invoiceMatched: boolean;
  createdAt: string;
  updatedAt: string;
  purchaseContract: PurchaseContract & {
    inquiry?: {
      id: string;
      inquiryDate: string;
    } | null;
  };
}

interface DeliveryReceiptFormData {
  purchaseContractId: string;
  deliveryDate: string;
  receivedQuantity: string;
  inspectionResult: string;
  receiptStatus: string;
  invoiceMatched: boolean;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyForm: DeliveryReceiptFormData = {
  purchaseContractId: "",
  deliveryDate: "",
  receivedQuantity: "",
  inspectionResult: "待检",
  receiptStatus: "待验收",
  invoiceMatched: false,
};

const inspectionColorMap: Record<string, string> = {
  待检: "ios-badge-orange",
  合格: "ios-badge-green",
  不合格: "ios-badge-red",
};

const receiptStatusColorMap: Record<string, string> = {
  待验收: "ios-badge-gray",
  已验收: "ios-badge-green",
  已拒绝: "ios-badge-red",
};

export default function DeliveryReceiptsPage() {
  const [receipts, setReceipts] = useState<DeliveryReceipt[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterInspection, setFilterInspection] = useState("");
  const [filterReceiptStatus, setFilterReceiptStatus] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<DeliveryReceipt | null>(
    null
  );
  const [form, setForm] = useState<DeliveryReceiptFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [detailReceipt, setDetailReceipt] = useState<DeliveryReceipt | null>(
    null
  );

  const [contracts, setContracts] = useState<PurchaseContract[]>([]);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterInspection) params.set("inspectionResult", filterInspection);
      if (filterReceiptStatus)
        params.set("receiptStatus", filterReceiptStatus);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/delivery-receipts?${params}`);
      const json = await res.json();

      if (res.ok) {
        setReceipts(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取到货验收列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterInspection, filterReceiptStatus, pagination.page, pagination.pageSize]);

  const fetchContracts = useCallback(async () => {
    try {
      const res = await fetch("/api/purchase-contracts?status=生效");
      const json = await res.json();
      if (res.ok) {
        setContracts(json.data || []);
      }
    } catch (err) {
      console.error("获取采购合同列表失败:", err);
    }
  }, []);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const handleOpenCreate = () => {
    setEditingReceipt(null);
    setForm(emptyForm);
    setFormError("");
    fetchContracts();
    setShowModal(true);
  };

  const handleOpenEdit = (receipt: DeliveryReceipt) => {
    setEditingReceipt(receipt);
    setForm({
      purchaseContractId: receipt.purchaseContractId,
      deliveryDate: receipt.deliveryDate
        ? new Date(receipt.deliveryDate).toISOString().split("T")[0]
        : "",
      receivedQuantity: receipt.receivedQuantity,
      inspectionResult: receipt.inspectionResult,
      receiptStatus: receipt.receiptStatus,
      invoiceMatched: receipt.invoiceMatched,
    });
    setFormError("");
    fetchContracts();
    setShowModal(true);
  };

  const handleOpenDetail = async (receipt: DeliveryReceipt) => {
    try {
      const res = await fetch(`/api/delivery-receipts/${receipt.id}`);
      const json = await res.json();
      if (res.ok) {
        setDetailReceipt(json.data);
      }
    } catch (err) {
      console.error("获取验收详情失败:", err);
    }
  };

  const handleSubmit = async () => {
    if (!form.purchaseContractId) {
      setFormError("请选择采购合同");
      return;
    }
    if (!form.receivedQuantity.trim()) {
      setFormError("实收数量不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingReceipt
        ? `/api/delivery-receipts/${editingReceipt.id}`
        : "/api/delivery-receipts";
      const method = editingReceipt ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchReceipts();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickUpdate = async (
    receipt: DeliveryReceipt,
    field: "inspectionResult" | "receiptStatus",
    value: string
  ) => {
    try {
      const res = await fetch(`/api/delivery-receipts/${receipt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (res.ok) {
        fetchReceipts();
      } else {
        const json = await res.json();
        alert(json.error || "更新失败");
      }
    } catch {
      alert("网络错误，请重试");
    }
  };

  const handleToggleInvoice = async (receipt: DeliveryReceipt) => {
    try {
      const res = await fetch(`/api/delivery-receipts/${receipt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceMatched: !receipt.invoiceMatched }),
      });

      if (res.ok) {
        fetchReceipts();
      } else {
        const json = await res.json();
        alert(json.error || "更新失败");
      }
    } catch {
      alert("网络错误，请重试");
    }
  };

  const updateForm = (
    field: keyof DeliveryReceiptFormData,
    value: string | boolean
  ) => {
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
            <h1>到货验收</h1>
            <p>管理采购到货验收记录，跟踪检验结果与发票匹配</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增验收记录
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
              placeholder="搜索合同编号、供应商..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <select
            className="ios-select w-[140px]"
            value={filterInspection}
            onChange={(e) => {
              setFilterInspection(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部检验</option>
            <option value="待检">待检</option>
            <option value="合格">合格</option>
            <option value="不合格">不合格</option>
          </select>

          <select
            className="ios-select w-[140px]"
            value={filterReceiptStatus}
            onChange={(e) => {
              setFilterReceiptStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部状态</option>
            <option value="待验收">待验收</option>
            <option value="已验收">已验收</option>
            <option value="已拒绝">已拒绝</option>
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
        ) : receipts.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
              <Truck className="w-8 h-8 text-[#86868B]" />
            </div>
            <p>
              {search || filterInspection || filterReceiptStatus
                ? "没有匹配的验收记录"
                : "暂无验收记录，点击右上角新增"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>采购合同编号</th>
                  <th>供应商</th>
                  <th>到货日期</th>
                  <th>实收数量</th>
                  <th>检验结果</th>
                  <th>验收状态</th>
                  <th>发票匹配</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                          <FileCheck className="w-4 h-4 text-[#007AFF]" />
                        </div>
                        <span className="font-semibold">
                          {receipt.purchaseContract?.contractNo || "-"}
                        </span>
                      </div>
                    </td>
                    <td>
                      {receipt.purchaseContract?.supplier?.name || "-"}
                    </td>
                    <td className="text-[#86868B]">
                      {formatDate(receipt.deliveryDate)}
                    </td>
                    <td>{receipt.receivedQuantity}</td>
                    <td>
                      {receipt.inspectionResult === "待检" ? (
                        <button
                          className="ios-badge ios-badge-orange cursor-pointer hover:opacity-80"
                          onClick={() =>
                            handleQuickUpdate(receipt, "inspectionResult", "合格")
                          }
                          title="点击标记为合格"
                        >
                          {receipt.inspectionResult}
                        </button>
                      ) : (
                        <span
                          className={`ios-badge ${inspectionColorMap[receipt.inspectionResult] || "ios-badge-gray"}`}
                        >
                          {receipt.inspectionResult}
                        </span>
                      )}
                    </td>
                    <td>
                      {receipt.receiptStatus === "待验收" &&
                      receipt.inspectionResult === "合格" ? (
                        <div className="flex items-center gap-1">
                          <button
                            className="ios-badge ios-badge-green cursor-pointer hover:opacity-80"
                            onClick={() =>
                              handleQuickUpdate(receipt, "receiptStatus", "已验收")
                            }
                            title="点击验收通过"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            验收
                          </button>
                          <button
                            className="ios-badge ios-badge-red cursor-pointer hover:opacity-80"
                            onClick={() =>
                              handleQuickUpdate(receipt, "receiptStatus", "已拒绝")
                            }
                            title="点击拒绝"
                          >
                            <XCircle className="w-3 h-3" />
                            拒绝
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`ios-badge ${receiptStatusColorMap[receipt.receiptStatus] || "ios-badge-gray"}`}
                        >
                          {receipt.receiptStatus}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className={`ios-badge cursor-pointer hover:opacity-80 ${receipt.invoiceMatched ? "ios-badge-blue" : "ios-badge-gray"}`}
                        onClick={() => handleToggleInvoice(receipt)}
                        title="点击切换发票匹配状态"
                      >
                        {receipt.invoiceMatched ? "是" : "否"}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenDetail(receipt)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          详情
                        </button>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenEdit(receipt)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
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
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                >
                  上一页
                </button>
                <span className="text-[13px] text-[#86868B] px-3">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
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
        title={editingReceipt ? "编辑验收记录" : "新增验收记录"}
        maxWidth="600px"
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
                采购合同 <span className="text-[#FF3B30]">*</span>
              </label>
              <select
                className="ios-select"
                value={form.purchaseContractId}
                onChange={(e) =>
                  updateForm("purchaseContractId", e.target.value)
                }
                disabled={!!editingReceipt}
              >
                <option value="">请选择采购合同</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contractNo} - {c.supplier?.name || "未知供应商"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                到货日期
              </label>
              <input
                type="date"
                className="ios-input"
                value={form.deliveryDate}
                onChange={(e) =>
                  updateForm("deliveryDate", e.target.value)
                }
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                实收数量 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入实收数量"
                value={form.receivedQuantity}
                onChange={(e) =>
                  updateForm("receivedQuantity", e.target.value)
                }
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                检验结果
              </label>
              <select
                className="ios-select"
                value={form.inspectionResult}
                onChange={(e) =>
                  updateForm("inspectionResult", e.target.value)
                }
              >
                <option value="待检">待检</option>
                <option value="合格">合格</option>
                <option value="不合格">不合格</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                验收状态
              </label>
              <select
                className="ios-select"
                value={form.receiptStatus}
                onChange={(e) =>
                  updateForm("receiptStatus", e.target.value)
                }
              >
                <option value="待验收">待验收</option>
                <option value="已验收">已验收</option>
                <option value="已拒绝">已拒绝</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="flex items-center gap-2.5 cursor-pointer py-2">
                <input
                  type="checkbox"
                  className="w-4.5 h-4.5 rounded-md border-[#D1D1D6] text-[#007AFF] focus:ring-[#007AFF]"
                  checked={form.invoiceMatched}
                  onChange={(e) =>
                    updateForm("invoiceMatched", e.target.checked)
                  }
                />
                <span className="text-[13px] font-semibold text-[#1D1D1F]">
                  发票已匹配
                </span>
              </label>
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
              {saving
                ? "保存中..."
                : editingReceipt
                  ? "保存修改"
                  : "创建验收记录"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailReceipt}
        onClose={() => setDetailReceipt(null)}
        title="验收记录详情"
        maxWidth="600px"
      >
        {detailReceipt && (
          <div className="space-y-5">
            <div>
              <h3 className="text-[13px] font-semibold text-[#86868B] uppercase tracking-wider mb-3">
                合同信息
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[12px] text-[#86868B]">采购合同编号</span>
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">
                    {detailReceipt.purchaseContract?.contractNo || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#86868B]">供应商</span>
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">
                    {detailReceipt.purchaseContract?.supplier?.name || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#86868B]">合同金额</span>
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">
                    ¥{Number(detailReceipt.purchaseContract?.totalAmount || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#86868B]">合同状态</span>
                  <p className="text-[14px]">
                    <span className="ios-badge ios-badge-green">
                      {detailReceipt.purchaseContract?.status || "-"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-[#F0F0F0] pt-4">
              <h3 className="text-[13px] font-semibold text-[#86868B] uppercase tracking-wider mb-3">
                验收信息
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[12px] text-[#86868B]">到货日期</span>
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">
                    {formatDate(detailReceipt.deliveryDate)}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#86868B]">实收数量</span>
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">
                    {detailReceipt.receivedQuantity}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#86868B]">检验结果</span>
                  <p className="text-[14px]">
                    <span
                      className={`ios-badge ${inspectionColorMap[detailReceipt.inspectionResult] || "ios-badge-gray"}`}
                    >
                      {detailReceipt.inspectionResult}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#86868B]">验收状态</span>
                  <p className="text-[14px]">
                    <span
                      className={`ios-badge ${receiptStatusColorMap[detailReceipt.receiptStatus] || "ios-badge-gray"}`}
                    >
                      {detailReceipt.receiptStatus}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#86868B]">发票匹配</span>
                  <p className="text-[14px]">
                    <span
                      className={`ios-badge ${detailReceipt.invoiceMatched ? "ios-badge-blue" : "ios-badge-gray"}`}
                    >
                      {detailReceipt.invoiceMatched ? "是" : "否"}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#86868B]">创建时间</span>
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">
                    {formatDate(detailReceipt.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {detailReceipt.inspectionResult === "合格" &&
              detailReceipt.receiptStatus === "已验收" && (
                <div className="border-t border-[#F0F0F0] pt-4">
                  <div className="p-3 rounded-xl bg-[#34C759]/8 text-[#34C759] text-[13px] font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    检验合格且已验收通过，可通知财务安排付款
                  </div>
                </div>
              )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                className="ios-btn ios-btn-secondary"
                onClick={() => setDetailReceipt(null)}
              >
                关闭
              </button>
              <button
                className="ios-btn ios-btn-primary"
                onClick={() => {
                  setDetailReceipt(null);
                  handleOpenEdit(detailReceipt);
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
                编辑
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
