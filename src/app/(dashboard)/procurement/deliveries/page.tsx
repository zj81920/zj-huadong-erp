"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Eye,
  Truck,
  CheckCircle2,
  FileCheck,
  Trash2,
  FileText,
} from "lucide-react";
import Modal from "@/components/Modal";
import { ApprovalTimeline } from "@/components/ApprovalComponents";
import { useAuth } from "@/contexts/AuthContext";
import { useFlowConfigured } from "@/hooks/useFlowConfigured";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";

interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
}

interface ExpenseContract {
  id: string;
  contractNo: string;
  supplierId: string;
  totalAmount: number;
  status: string;
  supplier: Supplier;
  items?: {
    id: string;
    materialName: string;
    spec: string | null;
    unit: string | null;
    quantity: number | null;
    unitPrice: number | null;
    totalPrice: number | null;
  }[];
}

interface DeliveryReceipt {
  id: string;
  expenseContractId: string;
  deliveryDate: string;
  deliveryAmount?: string | null;
  acceptedAmount?: string | null;
  invoiceAmount?: string | null;
  invoiceNo?: string | null;
  inspectionResult: string;
  receiptStatus: string;
  invoiceMatched: boolean;
  attachments?: string | null;
  approvalInstanceId?: string | null;
  status?: string;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  items: {
    id: string;
    materialName: string;
    spec: string | null;
    unit: string | null;
    orderedQuantity: number | null;
    receivedQuantity: number | null;
    acceptedQuantity: number | null;
    inspectionResult: string;
    remark: string | null;
    contractItemId: string | null;
  }[];
  expenseContract: ExpenseContract & {
    inquiry?: {
      id: string;
      inquiryDate: string;
    } | null;
  };
}

interface DeliveryReceiptFormData {
  expenseContractId: string;
  deliveryDate: string;
  deliveryAmount: string;
  acceptedAmount: string;
  inspectionResult: string;
  items: {
    contractItemId: string;
    materialName: string;
    spec: string;
    unit: string;
    orderedQuantity: number;
    unitPrice: number;
    receivedQuantity: string;
    acceptedQuantity: string;
    inspectionResult: string;
    remark: string;
  }[];
  attachments: string[];
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceCode: string | null;
  invoiceType: string;
  invoiceDate: string;
  amount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  sellerName: string | null;
  remark: string | null;
  invoiceCategory: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
}

interface InvoiceFormData {
  invoiceNo: string;
  invoiceCode: string;
  invoiceType: string;
  invoiceDate: string;
  amount: string;
  taxRate: string;
  taxAmount: string;
  totalAmount: string;
  sellerName: string;
  remark: string;
}

const emptyInvoiceForm: InvoiceFormData = {
  invoiceNo: "",
  invoiceCode: "",
  invoiceType: "增值税专用发票",
  invoiceDate: new Date().toISOString().split("T")[0],
  amount: "",
  taxRate: "6",
  taxAmount: "0.00",
  totalAmount: "0.00",
  sellerName: "",
  remark: "",
};

const emptyForm: DeliveryReceiptFormData = {
  expenseContractId: "",
  deliveryDate: "",
  deliveryAmount: "",
  acceptedAmount: "",
  inspectionResult: "待检",
  items: [],
  attachments: [],
};

const inspectionColorMap: Record<string, string> = {
  待检: "ios-badge-orange",
  合格: "ios-badge-green",
  不合格: "ios-badge-red",
};

export default function DeliveryReceiptsPage() {
  const { user } = useAuth();
  const isAdminUser = user?.username === "admin";
  const { configured: flowConfigured } = useFlowConfigured("delivery_receipt");
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

  const [contracts, setContracts] = useState<ExpenseContract[]>([]);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceModalReceipt, setInvoiceModalReceipt] = useState<DeliveryReceipt | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormData>(emptyInvoiceForm);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [receiptInvoices, setReceiptInvoices] = useState<Record<string, Invoice[]>>({});
  const [deliveredMap, setDeliveredMap] = useState<Record<string, { qty: number; amount: number }>>({});
  const [uploading, setUploading] = useState(false);
  const [approvalInstance, setApprovalInstance] = useState<any>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);

  const {
    toggleSelect, selectAll, clearSelection, isAllSelected, selectedCount, isSelected,
  } = useBatchSelection(receipts.map((r) => r.id));

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterInspection) params.set("inspectionResult", filterInspection);
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
  }, [search, filterInspection, pagination.page, pagination.pageSize]);

  const fetchContracts = useCallback(async () => {
    try {
      const res = await fetch("/api/expense-contracts?contractType=项目采购");
      const json = await res.json();
      if (res.ok) {
        setContracts(json.data || []);
      }
    } catch (err) {
      console.error("获取支出合同列表失败:", err);
    }
  }, []);

  const fetchApprovalInstance = useCallback(async (instanceId: string) => {
    setApprovalLoading(true);
    try {
      const res = await fetch(`/api/approval-instances/${instanceId}`);
      const json = await res.json();
      if (res.ok) {
        setApprovalInstance(json.data);
      }
    } catch (err) {
      console.error("获取审批实例失败:", err);
    } finally {
      setApprovalLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  useEffect(() => {
    const amt = parseFloat(invoiceForm.amount) || 0;
    const rate = parseFloat(invoiceForm.taxRate) / 100 || 0;
    const tax = amt * rate;
    setInvoiceForm((prev) => ({
      ...prev,
      taxAmount: tax.toFixed(2),
      totalAmount: (amt + tax).toFixed(2),
    }));
  }, [invoiceForm.amount, invoiceForm.taxRate]);

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
      expenseContractId: receipt.expenseContractId,
      deliveryDate: receipt.deliveryDate
        ? new Date(receipt.deliveryDate).toISOString().split("T")[0]
        : "",
      deliveryAmount: receipt.deliveryAmount || "",
      acceptedAmount: receipt.acceptedAmount || "",
      inspectionResult: receipt.inspectionResult,
      items: (receipt.items || []).map((item) => ({
        contractItemId: item.contractItemId || "",
        materialName: item.materialName,
        spec: item.spec || "",
        unit: item.unit || "",
        orderedQuantity: item.orderedQuantity || 0,
        unitPrice: (item as any).unitPrice || 0,
        receivedQuantity: item.receivedQuantity?.toString() || "",
        acceptedQuantity: item.acceptedQuantity?.toString() || "",
        inspectionResult: item.inspectionResult || "待检",
        remark: item.remark || "",
      })),
      attachments: typeof receipt.attachments === 'string' ? JSON.parse(receipt.attachments || '[]') : ((receipt as any).attachments || []),
    });
    setFormError("");
    fetchContracts();
    setShowModal(true);
  };

  const handleOpenDetail = async (receipt: DeliveryReceipt) => {
    setApprovalInstance(null);
    try {
      const res = await fetch(`/api/delivery-receipts/${receipt.id}`);
      const json = await res.json();
      if (res.ok) {
        setDetailReceipt(json.data);
        if (json.data?.approvalInstanceId) {
          fetchApprovalInstance(json.data.approvalInstanceId);
        }
        const contractId = json.data?.expenseContract?.id;
        if (contractId) {
          fetchInvoicesForReceipt(contractId, receipt.id);
        }
      }
    } catch (err) {
      console.error("获取验收详情失败:", err);
    }
  };

  const handleSubmit = async () => {
    if (!form.expenseContractId) {
      setFormError("请选择支出合同");
      return;
    }
    if (form.items.length === 0) {
      setFormError("请选择包含物资明细的合同");
      return;
    }
    const hasReceived = form.items.some(
      (item) => item.receivedQuantity && Number(item.receivedQuantity) > 0
    );
    if (!hasReceived) {
      setFormError("至少填写一项实收数量");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingReceipt
        ? `/api/delivery-receipts/${editingReceipt.id}`
        : "/api/delivery-receipts";
      const method = editingReceipt ? "PUT" : "POST";

      const payload = {
        ...form,
        attachments: JSON.stringify(form.attachments),
        items: form.items.map((item) => ({
          ...item,
          receivedQuantity: Number(item.receivedQuantity) || 0,
          acceptedQuantity: Number(item.acceptedQuantity) || 0,
        })),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const handleContractChange = async (contractId: string) => {
    updateForm("expenseContractId", contractId);
    if (!contractId) {
      setForm((prev) => ({ ...prev, items: [] }));
      setDeliveredMap({});
      return;
    }
    try {
      const [contractRes, deliveryRes] = await Promise.all([
        fetch(`/api/expense-contracts/${contractId}`),
        fetch(`/api/delivery-receipts?expenseContractId=${contractId}&pageSize=200`),
      ]);
      const contractJson = await contractRes.json();
      const deliveryJson = await deliveryRes.json();

      const deliveredMap: Record<string, { qty: number; amount: number }> = {};

      if (deliveryJson.ok !== false && deliveryJson.data) {
        const receipts = Array.isArray(deliveryJson.data) ? deliveryJson.data : deliveryJson.data?.data || [];
        for (const receipt of receipts) {
          if (receipt.inspectionResult === "合格" && receipt.items) {
            for (const item of receipt.items) {
              if (item.contractItemId) {
                if (!deliveredMap[item.contractItemId]) {
                  deliveredMap[item.contractItemId] = { qty: 0, amount: 0 };
                }
                deliveredMap[item.contractItemId].qty += Number(item.receivedQuantity || 0);
                deliveredMap[item.contractItemId].amount += Number(item.receivedQuantity || 0) * Number(item.unitPrice || 0);
              }
            }
          }
        }
      }

      setDeliveredMap(deliveredMap);

      if (contractJson.data?.items) {
        const mappedItems = contractJson.data.items.map((item: any) => ({
          contractItemId: item.id,
          materialName: item.materialName,
          spec: item.spec || "",
          unit: item.unit || "",
          orderedQuantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
          receivedQuantity: "",
          acceptedQuantity: "",
          inspectionResult: "待检",
          remark: "",
        }));
        setForm((prev) => ({ ...prev, items: mappedItems }));
      }
    } catch (error) {
      console.error("加载合同明细失败:", error);
    }
  };

  const handleDelete = async (receipt: DeliveryReceipt) => {
    if (!confirm(`确认删除该验收记录？`)) return;
    try {
      const res = await fetch(`/api/delivery-receipts/${receipt.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchReceipts();
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
      }
    } catch {
      alert("网络错误，请重试");
    }
  };

  const handleOpenInvoice = (receipt: DeliveryReceipt) => {
    setInvoiceModalReceipt(receipt);
    setInvoiceForm({
      ...emptyInvoiceForm,
      sellerName: (receipt.expenseContract as any)?.supplier?.name || "",
    });
    setInvoiceError("");
    setShowInvoiceModal(true);
  };

  const fetchInvoicesForReceipt = async (contractId: string, receiptId: string) => {
    try {
      const res = await fetch(`/api/invoices?sourceType=expense_contract&sourceId=${contractId}`);
      const json = await res.json();
      if (res.ok) {
        setReceiptInvoices((prev) => ({
          ...prev,
          [receiptId]: json.data || [],
        }));
      }
    } catch (err) {
      console.error("获取关联发票失败:", err);
    }
  };

  const handleInvoiceSubmit = async () => {
    if (!invoiceForm.invoiceNo) {
      setInvoiceError("请输入发票号码");
      return;
    }
    if (!invoiceModalReceipt) return;

    const contractId = (invoiceModalReceipt.expenseContract as any)?.id;
    if (!contractId) {
      setInvoiceError("该验收记录未关联合同，无法登记发票");
      return;
    }

    setInvoiceSubmitting(true);
    setInvoiceError("");
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...invoiceForm,
          invoiceCategory: "收票",
          sourceType: "expense_contract",
          sourceId: contractId,
          projectSourceId:
            (invoiceModalReceipt.expenseContract as any)?.projectSourceId ||
            null,
          amount: parseFloat(invoiceForm.amount) || 0,
          taxRate: parseFloat(invoiceForm.taxRate) / 100,
          taxAmount: parseFloat(invoiceForm.taxAmount) || 0,
          totalAmount: parseFloat(invoiceForm.totalAmount) || 0,
        }),
      });
      if (res.ok) {
        setShowInvoiceModal(false);
        fetchReceipts();
      } else {
        const json = await res.json();
        setInvoiceError(json.error || "登记发票失败");
      }
    } catch {
      setInvoiceError("网络错误，请重试");
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const updateFormItem = (
    index: number,
    field: string,
    value: string
  ) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
    if (formError) setFormError("");
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
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
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

          <div className="ml-auto text-[13px] text-[#6B7280]">
            共 <span className="font-semibold text-[#111827]">{pagination.total}</span> 条记录
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#111827] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F9FAFB] flex items-center justify-center">
              <Truck className="w-8 h-8 text-[#6B7280]" />
            </div>
            <p>
              {search || filterInspection
                ? "没有匹配的验收记录"
                : "暂无验收记录，点击右上角新增"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  {isAdminUser && <th className="w-10"><input type="checkbox" className="ios-checkbox" checked={isAllSelected} onChange={() => isAllSelected ? clearSelection() : selectAll()} /></th>}
                  <th>支出合同编号</th>
                  <th>供应商</th>
                  <th>到货日期</th>
                  <th>实收数量</th>
                  <th>到货金额</th>
                  <th>检验结果</th>
                  <th>附件</th>
                  <th>发票匹配</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={receipt.id} className={isSelected(receipt.id) ? "bg-[#111827]/5" : ""}>
                    {isAdminUser && (
                      <td className="w-10">
                        <input type="checkbox" className="ios-checkbox" checked={isSelected(receipt.id)} onChange={() => toggleSelect(receipt.id)} />
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#111827]/10 flex items-center justify-center flex-shrink-0">
                          <FileCheck className="w-4 h-4 text-[#111827]" />
                        </div>
                        <span className="font-semibold">
                          {receipt.expenseContract?.contractNo || "-"}
                        </span>
                      </div>
                    </td>
                    <td>
                      {receipt.expenseContract?.supplier?.name || "-"}
                    </td>
                    <td className="text-[#6B7280]">
                      {formatDate(receipt.deliveryDate)}
                    </td>
                    <td>
                      {receipt.items && receipt.items.length > 0
                        ? receipt.items.reduce(
                            (sum, item) => sum + (item.receivedQuantity || 0),
                            0
                          )
                        : "-"}
                    </td>
                    <td>
                      {receipt.deliveryAmount
                        ? `¥${Number(receipt.deliveryAmount).toLocaleString()}`
                        : "-"}
                    </td>
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
                      {(() => {
                        const atts: string[] = typeof receipt.attachments === 'string' ? JSON.parse(receipt.attachments || '[]') : ((receipt as any).attachments || []);
                        return atts.length > 0 ? (
                          <button
                            className="ios-badge ios-badge-blue cursor-pointer hover:opacity-80"
                            onClick={() => handleOpenDetail(receipt)}
                            title="点击查看详情"
                          >
                            {atts.length} 个附件
                          </button>
                        ) : (
                          <span className="text-[#6B7280] text-[12px]">-</span>
                        );
                      })()}
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
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm text-[#111827]"
                          onClick={() => handleOpenInvoice(receipt)}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          登记发票
                        </button>
                        {isAdminUser && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#6B7280]"
                            onClick={() => handleDelete(receipt)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="text-[#6B7280] text-[12px] whitespace-nowrap">
                      {receipt.lastModifiedBy && (
                        <span>{receipt.lastModifiedBy}</span>
                      )}
                      <span className="block text-[11px]">{formatDate(receipt.updatedAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-[#F3F4F6]">
                <button
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                >
                  上一页
                </button>
                <span className="text-[13px] text-[#6B7280] px-3">
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

      {isAdminUser && (
        <BatchDeleteBar
          businessType="delivery_receipt"
          selectedIds={receipts.filter((d) => isSelected(d.id)).map((d) => d.id)}
          onDeleteSuccess={fetchReceipts}
          onClear={clearSelection}
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingReceipt ? "编辑验收记录" : "新增验收记录"}
        maxWidth="900px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#6B7280]/8 text-[#6B7280] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                支出合同（采购类） <span className="text-[#6B7280]">*</span>
              </label>
              <select
                className="ios-select"
                value={form.expenseContractId}
                onChange={(e) =>
                  handleContractChange(e.target.value)
                }
                disabled={!!editingReceipt}
              >
                <option value="">请选择支出合同</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contractNo} - {c.supplier?.name || "未知供应商"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
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
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                到货金额
              </label>
              <input
                type="number"
                step="0.01"
                className="ios-input"
                placeholder="请输入到货金额"
                value={form.deliveryAmount}
                onChange={(e) =>
                  updateForm("deliveryAmount", e.target.value)
                }
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                验收合格金额
              </label>
              <input
                type="number"
                step="0.01"
                className="ios-input"
                placeholder="请输入验收合格金额"
                value={form.acceptedAmount}
                onChange={(e) =>
                  updateForm("acceptedAmount", e.target.value)
                }
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
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
          </div>

          {form.items.length > 0 && (
            <div>
              <h3 className="text-[13px] font-semibold text-[#111827] mb-2">
                物资明细
              </h3>
              <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                <table className="ios-table text-[12px]">
                  <thead>
                    <tr>
                      <th>物资名称</th>
                      <th>规格</th>
                      <th>单位</th>
                      <th>采购数量</th>
                      <th>单价(元)</th>
                      <th>已到货数量</th>
                      <th>已到货金额</th>
                      <th>本次到货数量</th>
                      <th>本次到货金额</th>
                      <th>检验结果</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="font-medium whitespace-nowrap">
                          {item.materialName}
                        </td>
                        <td className="text-[#6B7280]">{item.spec || "-"}</td>
                        <td>{item.unit || "-"}</td>
                        <td className="text-center">{item.orderedQuantity}</td>
                        <td className="text-right">{Number(item.unitPrice || 0).toFixed(2)}</td>
                        <td className="text-center">
                          {deliveredMap[item.contractItemId]?.qty || 0}
                        </td>
                        <td className="text-right">
                          {(deliveredMap[item.contractItemId]?.amount || 0).toFixed(2)}
                        </td>
                        <td>
                          <input
                            type="number"
                            className="ios-input !py-1 !text-[12px] text-center w-[80px]"
                            value={item.receivedQuantity}
                            onChange={(e) =>
                              updateFormItem(idx, "receivedQuantity", e.target.value)
                            }
                            min={0}
                          />
                        </td>
                        <td className="text-right font-medium">
                          {(Number(item.receivedQuantity || 0) * Number(item.unitPrice || 0)).toFixed(2)}
                        </td>
                        <td>
                          <select
                            className="ios-select !py-1 !text-[12px] !w-[80px]"
                            value={item.inspectionResult}
                            onChange={(e) =>
                              updateFormItem(idx, "inspectionResult", e.target.value)
                            }
                          >
                            <option value="待检">待检</option>
                            <option value="合格">合格</option>
                            <option value="不合格">不合格</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="ios-input !py-1 !text-[12px] w-[100px]"
                            value={item.remark}
                            onChange={(e) =>
                              updateFormItem(idx, "remark", e.target.value)
                            }
                            placeholder="备注"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#111827] mb-2">
              附件上传
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.attachments.map((url, idx) => (
                <div key={idx} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#6B7280]/10 text-[#6B7280] text-[12px] font-medium">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline max-w-[150px] truncate">
                    {url.split('/').pop()?.split('?')[0] || `附件${idx + 1}`}
                  </a>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))}
                    className="ml-1 text-[#6B7280] hover:text-[#6B7280]/70"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-[#E5E7EB] cursor-pointer hover:border-[#111827] hover:bg-[#111827]/5 transition-all text-[13px] text-[#6B7280]">
              {uploading ? (
                <><span className="w-4 h-4 border-2 border-[#111827] border-t-transparent rounded-full animate-spin" /> 上传中...</>
              ) : (
                <>📎 点击上传验收资料/照片</>
              )}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.rar"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) { alert("文件大小不能超过10MB"); return; }
                  setUploading(true);
                  const formData = new FormData();
                  formData.append("file", file);
                  try {
                    const res = await fetch("/api/upload", { method: "POST", body: formData });
                    const json = await res.json();
                    if (res.ok) {
                      setForm(prev => ({ ...prev, attachments: [...prev.attachments, json.url] }));
                    } else {
                      alert(json.error || "上传失败");
                    }
                  } catch { alert("上传失败"); }
                  finally { setUploading(false); }
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F3F4F6] mt-2">
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
        onClose={() => { setDetailReceipt(null); setApprovalInstance(null); }}
        title="验收记录详情"
        maxWidth="900px"
      >
        {detailReceipt && (
          <div className="space-y-5">
            <div>
              <h3 className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
                合同信息
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[12px] text-[#6B7280]">支出合同编号</span>
                  <p className="text-[14px] font-semibold text-[#111827]">
                    {detailReceipt.expenseContract?.contractNo || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7280]">供应商</span>
                  <p className="text-[14px] font-semibold text-[#111827]">
                    {detailReceipt.expenseContract?.supplier?.name || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7280]">合同金额</span>
                  <p className="text-[14px] font-semibold text-[#111827]">
                    ¥{Number(detailReceipt.expenseContract?.totalAmount || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7280]">合同状态</span>
                  <p className="text-[14px]">
                    <span className="ios-badge ios-badge-green">
                      {detailReceipt.expenseContract?.status || "-"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-[#F3F4F6] pt-4">
              <h3 className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
                验收信息
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[12px] text-[#6B7280]">到货日期</span>
                  <p className="text-[14px] font-semibold text-[#111827]">
                    {formatDate(detailReceipt.deliveryDate)}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7280]">实收数量</span>
                  <p className="text-[14px] font-semibold text-[#111827]">
                    {detailReceipt.items && detailReceipt.items.length > 0
                      ? detailReceipt.items.reduce(
                          (sum, item) => sum + (item.receivedQuantity || 0),
                          0
                        )
                      : "-"}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7280]">到货金额</span>
                  <p className="text-[14px] font-semibold text-[#111827]">
                    {detailReceipt.deliveryAmount
                      ? `¥${Number(detailReceipt.deliveryAmount).toLocaleString()}`
                      : "-"}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7280]">检验结果</span>
                  <p className="text-[14px]">
                    <span
                      className={`ios-badge ${inspectionColorMap[detailReceipt.inspectionResult] || "ios-badge-gray"}`}
                    >
                      {detailReceipt.inspectionResult}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7280]">创建时间</span>
                  <p className="text-[14px] font-semibold text-[#111827]">
                    {formatDate(detailReceipt.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {detailReceipt.items && detailReceipt.items.length > 0 && (
              <div className="border-t border-[#F3F4F6] pt-4">
                <h3 className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
                  物资明细
                </h3>
                <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                  <table className="ios-table text-[12px]">
                    <thead>
                      <tr>
                        <th>物资名称</th>
                        <th>规格</th>
                        <th>单位</th>
                        <th>合同数量</th>
                        <th>实收数量</th>
                        <th>合格数量</th>
                        <th>检验结果</th>
                        <th>备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailReceipt.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="font-medium whitespace-nowrap">
                            {item.materialName}
                          </td>
                          <td className="whitespace-nowrap">{item.spec || "-"}</td>
                          <td>{item.unit || "-"}</td>
                          <td>{item.orderedQuantity ?? "-"}</td>
                          <td>{item.receivedQuantity ?? "-"}</td>
                          <td>{item.acceptedQuantity ?? "-"}</td>
                          <td>
                            <span
                              className={`ios-badge ${inspectionColorMap[item.inspectionResult] || "ios-badge-gray"}`}
                            >
                              {item.inspectionResult}
                            </span>
                          </td>
                          <td>{item.remark || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {receiptInvoices[detailReceipt.id] && receiptInvoices[detailReceipt.id].length > 0 && (
              <div className="border-t border-[#F3F4F6] pt-4">
                <h3 className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
                  已关联发票
                </h3>
                <div className="space-y-2">
                  {receiptInvoices[detailReceipt.id].map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[#F9FAFB]"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#111827]/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-[#111827]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-[#111827]">
                            {inv.invoiceNo}
                          </span>
                          <span className="ios-badge ios-badge-blue text-[11px]">
                            {inv.invoiceType}
                          </span>
                        </div>
                        <div className="text-[12px] text-[#6B7280] mt-0.5">
                          {inv.invoiceDate ? formatDate(inv.invoiceDate) : "-"}
                          {inv.sellerName ? ` · ${inv.sellerName}` : ""}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[14px] font-semibold text-[#111827]">
                          ¥{Number(inv.totalAmount).toLocaleString()}
                        </div>
                        <div className="text-[11px] text-[#6B7280]">
                          不含税 ¥{Number(inv.amount).toLocaleString()} · 税额 ¥{Number(inv.taxAmount).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailReceipt.inspectionResult === "合格" &&
              detailReceipt.receiptStatus === "已验收" && (
                <div className="border-t border-[#F3F4F6] pt-4">
                  <div className="p-3 rounded-xl bg-[#6B7280]/8 text-[#6B7280] text-[13px] font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    检验合格且已验收通过，可通知财务安排付款
                  </div>
                </div>
              )}

            {(() => {
              const detailAtts: string[] = typeof detailReceipt.attachments === 'string' ? JSON.parse(detailReceipt.attachments || '[]') : ((detailReceipt as any).attachments || []);
              return detailAtts.length > 0 ? (
                <div className="border-t border-[#F3F4F6] pt-4">
                  <h3 className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
                    附件
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {detailAtts.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F9FAFB] hover:bg-[#111827]/10 transition-colors text-[13px] text-[#111827]"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#111827] flex-shrink-0" />
                        <span className="max-w-[200px] truncate">
                          {url.split('/').pop()?.split('?')[0] || `附件${idx + 1}`}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            <ApprovalTimeline instance={approvalInstance} loading={approvalLoading} />

            <div className="flex justify-end gap-3 pt-2">
              <button
                className="ios-btn ios-btn-secondary"
                onClick={() => { setDetailReceipt(null); setApprovalInstance(null); }}
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

      <Modal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title="登记发票"
        maxWidth="700px"
      >
        <div className="space-y-4">
          {invoiceError && (
            <div className="p-3 rounded-xl bg-[#6B7280]/8 text-[#6B7280] text-[13px] font-medium">
              {invoiceError}
            </div>
          )}

          {invoiceModalReceipt && (
            <div className="p-3 rounded-xl bg-[#F9FAFB] text-[13px]">
              <span className="text-[#6B7280]">关联合同：</span>
              <span className="font-semibold text-[#111827]">
                {invoiceModalReceipt.expenseContract?.contractNo || "-"}
              </span>
              <span className="text-[#6B7280] ml-4">供应商：</span>
              <span className="font-semibold text-[#111827]">
                {invoiceModalReceipt.expenseContract?.supplier?.name || "-"}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                发票号码 <span className="text-[#6B7280]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入发票号码"
                value={invoiceForm.invoiceNo}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({ ...prev, invoiceNo: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                发票代码
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入发票代码"
                value={invoiceForm.invoiceCode}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({ ...prev, invoiceCode: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                发票类型
              </label>
              <select
                className="ios-select"
                value={invoiceForm.invoiceType}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({ ...prev, invoiceType: e.target.value }))
                }
              >
                <option value="增值税专用发票">增值税专用发票</option>
                <option value="增值税普通发票">增值税普通发票</option>
                <option value="增值税电子发票">增值税电子发票</option>
                <option value="收据">收据</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                开票日期
              </label>
              <input
                type="date"
                className="ios-input"
                value={invoiceForm.invoiceDate}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({ ...prev, invoiceDate: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                不含税金额
              </label>
              <input
                type="number"
                step="0.01"
                className="ios-input"
                placeholder="请输入不含税金额"
                value={invoiceForm.amount}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({ ...prev, amount: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                税率
              </label>
              <select
                className="ios-select"
                value={invoiceForm.taxRate}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({ ...prev, taxRate: e.target.value }))
                }
              >
                <option value="3">3%</option>
                <option value="6">6%</option>
                <option value="9">9%</option>
                <option value="13">13%</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                税额（自动计算）
              </label>
              <input
                type="text"
                className="ios-input bg-[#F9FAFB]"
                value={invoiceForm.taxAmount}
                readOnly
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                价税合计（自动计算）
              </label>
              <input
                type="text"
                className="ios-input bg-[#F9FAFB] font-semibold text-[#111827]"
                value={`¥${invoiceForm.totalAmount}`}
                readOnly
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                销方名称
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入销方名称"
                value={invoiceForm.sellerName}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({ ...prev, sellerName: e.target.value }))
                }
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                备注
              </label>
              <textarea
                className="ios-input min-h-[80px] resize-none"
                placeholder="请输入备注信息"
                value={invoiceForm.remark}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({ ...prev, remark: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F3F4F6] mt-2">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowInvoiceModal(false)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleInvoiceSubmit}
              disabled={invoiceSubmitting}
            >
              {invoiceSubmitting ? "提交中..." : "确认登记"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
