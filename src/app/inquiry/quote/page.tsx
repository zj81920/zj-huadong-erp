"use client";

import { useState, useEffect } from "react";
import { deleteUploadedFile } from "@/lib/upload-helpers";
import {
  Package,
  Clock,
  Send,
  CheckCircle,
  AlertCircle,
  FileText,
  Paperclip,
  Upload,
  X,
  File,
} from "lucide-react";

interface InquiryItem {
  id: string;
  materialName: string;
  spec: string | null;
  material: string | null;
  brand: string | null;
  standardNo: string | null;
  unit: string | null;
  quantity: number | string | null;
  remark: string | null;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface SupplierQuoteInfo {
  supplierId: string;
  supplier: { name: string };
  totalPrice: number | null;
  deliveryDays: number | null;
  quotedAt: string | null;
  items?: {
    id: string;
    purchaseRequestItemId: string;
    unitPrice: number | null;
    quantity: number | null;
    totalPrice: number | null;
    remark: string | null;
    purchaseRequestItem: {
      id: string;
      materialName: string;
      spec: string | null;
      unit: string | null;
      quantity: number | null;
    };
  }[];
}

interface InquiryData {
  id: string;
  projectSourceId: string;
  inquiryDate: string;
  onlineDeadline: string | null;
  attachments?: { name: string; url: string }[];
  suppliers: SupplierOption[];
  purchaseRequest: {
    requestNo: string;
    items: InquiryItem[];
  };
  supplierQuotes: SupplierQuoteInfo[];
}

export default function InquiryQuotePage() {
  const [loading, setLoading] = useState(true);
  const [inquiry, setInquiry] = useState<InquiryData | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [form, setForm] = useState({
    supplierId: "",
    deliveryDays: "",
    remark: "",
    quoteItems: {} as Record<string, { unitPrice: string; quantity: string }>,
    attachments: [] as { name: string; url: string }[],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setError("缺少询价令牌");
      setLoading(false);
      return;
    }
    fetch(`/api/inquiry-quote/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("获取询价信息失败");
        return res.json();
      })
      .then((json) => {
        setInquiry(json.data);
      })
      .catch((err) => {
        setError(err.message || "加载失败");
      })
      .finally(() => setLoading(false));
  }, []);

  const isExpired = inquiry?.onlineDeadline
    ? new Date(inquiry.onlineDeadline) < new Date()
    : false;

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

  const handleRemoveAttachment = async (index: number) => {
    await deleteUploadedFile(form.attachments[index].url);
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!form.supplierId) {
      setFormError("请选择您的公司");
      return;
    }
    const hasValidItem = inquiry?.purchaseRequest?.items?.some((item) => {
      const qi = form.quoteItems[item.id];
      return qi && qi.unitPrice && parseFloat(qi.unitPrice) > 0;
    });
    if (!hasValidItem) {
      setFormError("请至少填写一项物资的单价");
      return;
    }
    setSubmitting(true);
    try {
      const items = inquiry!.purchaseRequest?.items
        .map((item) => {
          const qi = form.quoteItems[item.id];
          if (!qi || !qi.unitPrice) return null;
          return {
            purchaseRequestItemId: item.id,
            unitPrice: parseFloat(qi.unitPrice) || null,
            quantity: qi.quantity
              ? parseFloat(qi.quantity)
              : null,
            totalPrice:
              (parseFloat(qi.unitPrice) || 0) *
              (parseFloat(qi.quantity || String(item.quantity)) || 0),
          };
        })
        .filter(Boolean);
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const res = await fetch(`/api/inquiry-quote/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: form.supplierId,
          totalPrice: items.reduce(
            (sum, i) => sum + (i?.totalPrice || 0),
            0
          ),
          deliveryDays: form.deliveryDays
            ? parseInt(form.deliveryDays)
            : null,
          remark: form.remark || null,
          attachments: form.attachments,
          items,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "提交失败");
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5EA] p-10 text-center max-w-[720px] w-full">
          <div className="animate-spin w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-[#86868B] text-[14px]">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5EA] p-10 text-center max-w-[720px] w-full">
          <AlertCircle className="w-12 h-12 text-[#FF3B30] mx-auto mb-4" />
          <h2 className="text-[18px] font-semibold text-[#1D1D1F] mb-2">
            加载失败
          </h2>
          <p className="text-[#86868B] text-[14px]">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5EA] p-10 text-center max-w-[720px] w-full">
          <CheckCircle className="w-16 h-16 text-[#34C759] mx-auto mb-4" />
          <h2 className="text-[20px] font-semibold text-[#1D1D1F] mb-2">
            报价提交成功
          </h2>
          <p className="text-[#86868B] text-[14px] mb-6">
            我们已收到您的报价，采购人员将尽快与您联系
          </p>
          {!isExpired && (
            <button
              onClick={() => setSubmitted(false)}
              className="bg-[#F5F5F7] text-[#1D1D1F] px-6 py-2.5 rounded-xl font-semibold text-[14px] hover:bg-[#E5E5EA] transition-colors"
            >
              修改报价
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!inquiry) return null;

  if (isExpired) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5EA] p-10 text-center max-w-[720px] w-full">
          <Clock className="w-12 h-12 text-[#FF9500] mx-auto mb-4" />
          <h2 className="text-[18px] font-semibold text-[#1D1D1F] mb-2">
            询价已截止
          </h2>
          <p className="text-[#86868B] text-[14px]">
            该询价已于{" "}
            {new Date(inquiry.onlineDeadline!).toLocaleString("zh-CN")} 截止，
            不再接受报价
          </p>
        </div>
      </div>
    );
  }

  const existingQuote = inquiry.supplierQuotes?.find(
    (q) => q.supplierId === form.supplierId && q.quotedAt
  );

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
      <div className="max-w-[860px] w-full mx-auto space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5EA] p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-[#007AFF]" />
            <h1 className="text-[20px] font-semibold text-[#1D1D1F]">
              询价报价单
            </h1>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-[#86868B]">项目编号：</span>
              <span className="text-[#1D1D1F] font-medium">
                {inquiry.projectSourceId}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-[#86868B]">请购单号：</span>
              <span className="text-[#1D1D1F] font-medium">
                {inquiry.purchaseRequest?.requestNo}
              </span>
            </div>
            {inquiry.onlineDeadline && (
              <div className="flex items-center gap-2 text-[13px]">
                <Clock className="w-3.5 h-3.5 text-[#FF9500]" />
                <span className="text-[#86868B]">截止时间：</span>
                <span className="text-[#FF9500] font-medium">
                  {new Date(inquiry.onlineDeadline).toLocaleString("zh-CN")}
                </span>
              </div>
            )}
          </div>
        </div>

        {inquiry.attachments && inquiry.attachments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5EA] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Paperclip className="w-5 h-5 text-[#007AFF]" />
              <h2 className="text-[16px] font-semibold text-[#1D1D1F]">
                采购方附件
              </h2>
            </div>
            <p className="text-[12px] text-[#86868B] mb-3">以下为采购方提供的参考资料，请查阅后进行报价</p>
            <div className="space-y-1.5">
              {inquiry.attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-[#F5F5F7]">
                  <File className="w-4 h-4 text-[#86868B] flex-shrink-0" />
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#007AFF] truncate hover:underline">{att.name}</a>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5EA] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-[#007AFF]" />
            <h2 className="text-[16px] font-semibold text-[#1D1D1F]">
              物资明细报价
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[12px] font-semibold text-[#86868B] px-3 py-2 border-b border-[#E5E5EA]">
                    物资名称
                  </th>
                  <th className="text-left text-[12px] font-semibold text-[#86868B] px-3 py-2 border-b border-[#E5E5EA]">
                    规格型号
                  </th>
                  <th className="text-left text-[12px] font-semibold text-[#86868B] px-3 py-2 border-b border-[#E5E5EA]">
                    材质
                  </th>
                  <th className="text-left text-[12px] font-semibold text-[#86868B] px-3 py-2 border-b border-[#E5E5EA]">
                    品牌
                  </th>
                  <th className="text-left text-[12px] font-semibold text-[#86868B] px-3 py-2 border-b border-[#E5E5EA]">
                    标准号
                  </th>
                  <th className="text-left text-[12px] font-semibold text-[#86868B] px-3 py-2 border-b border-[#E5E5EA]">
                    单位
                  </th>
                  <th className="text-right text-[12px] font-semibold text-[#86868B] px-3 py-2 border-b border-[#E5E5EA]">
                    需求数量
                  </th>
                  <th className="text-right text-[12px] font-semibold text-[#86868B] px-3 py-2 border-b border-[#E5E5EA]">
                    报价单价
                  </th>
                  <th className="text-right text-[12px] font-semibold text-[#86868B] px-3 py-2 border-b border-[#E5E5EA]">
                    报价数量
                  </th>
                  <th className="text-right text-[12px] font-semibold text-[#86868B] px-3 py-2 border-b border-[#E5E5EA]">
                    小计
                  </th>
                </tr>
              </thead>
              <tbody>
                {inquiry.purchaseRequest?.items?.map((item) => {
                  const qi = form.quoteItems[item.id] || {
                    unitPrice: "",
                    quantity: "",
                  };
                  const unitPrice = parseFloat(qi.unitPrice) || 0;
                  const qty = parseFloat(qi.quantity) || parseFloat(String(item.quantity)) || 0;
                  const subtotal = unitPrice * qty;
                  return (
                    <tr key={item.id}>
                      <td className="text-[13px] px-3 py-2.5 border-b border-[#F0F0F0] text-[#1D1D1F] font-medium">
                        {item.materialName}
                      </td>
                      <td className="text-[13px] px-3 py-2.5 border-b border-[#F0F0F0] text-[#86868B]">
                        {item.spec || "-"}
                      </td>
                      <td className="text-[13px] px-3 py-2.5 border-b border-[#F0F0F0] text-[#86868B]">
                        {item.material || "-"}
                      </td>
                      <td className="text-[13px] px-3 py-2.5 border-b border-[#F0F0F0] text-[#86868B]">
                        {item.brand || "-"}
                      </td>
                      <td className="text-[13px] px-3 py-2.5 border-b border-[#F0F0F0] text-[#86868B]">
                        {item.standardNo || "-"}
                      </td>
                      <td className="text-[13px] px-3 py-2.5 border-b border-[#F0F0F0] text-[#86868B]">
                        {item.unit || "-"}
                      </td>
                      <td className="text-[13px] px-3 py-2.5 border-b border-[#F0F0F0] text-[#1D1D1F] text-right">
                        {item.quantity != null ? String(item.quantity) : "-"}
                      </td>
                      <td className="text-[13px] px-3 py-2.5 border-b border-[#F0F0F0]">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={qi.unitPrice}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              quoteItems: {
                                ...prev.quoteItems,
                                [item.id]: {
                                  ...prev.quoteItems[item.id],
                                  unitPrice: e.target.value,
                                  quantity:
                                    prev.quoteItems[item.id]?.quantity ??
                                    "",
                                },
                              },
                            }))
                          }
                          placeholder="单价"
                          className="w-full min-w-[80px] px-2 py-1 rounded-lg border border-[#D1D1D6] text-[13px] text-right focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent"
                        />
                      </td>
                      <td className="text-[13px] px-3 py-2.5 border-b border-[#F0F0F0]">
                        <input
                          type="number"
                          min="0"
                          value={qi.quantity}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              quoteItems: {
                                ...prev.quoteItems,
                                [item.id]: {
                                  ...prev.quoteItems[item.id],
                                  quantity: e.target.value,
                                  unitPrice:
                                    prev.quoteItems[item.id]?.unitPrice ??
                                    "",
                                },
                              },
                            }))
                          }
                          placeholder={item.quantity != null ? String(item.quantity) : "数量"}
                          className="w-full min-w-[80px] px-2 py-1 rounded-lg border border-[#D1D1D6] text-[13px] text-right focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent"
                        />
                      </td>
                      <td className="text-[13px] px-3 py-2.5 border-b border-[#F0F0F0] text-[#1D1D1F] text-right font-medium">
                        {unitPrice > 0 ? `¥${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={9} className="text-[13px] font-semibold text-[#1D1D1F] px-3 py-3 text-right">
                    报价合计
                  </td>
                  <td className="text-[14px] font-bold text-[#007AFF] px-3 py-3 text-right">
                    ¥
                    {(inquiry.purchaseRequest?.items || [])
                      .reduce((sum, item) => {
                        const qi = form.quoteItems[item.id];
                        if (!qi?.unitPrice) return sum;
                        const u = parseFloat(qi.unitPrice) || 0;
                        const q =
                          parseFloat(qi.quantity) ||
                          parseFloat(String(item.quantity)) ||
                          0;
                        return sum + u * q;
                      }, 0)
                      .toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5EA] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-[#007AFF]" />
              <h2 className="text-[16px] font-semibold text-[#1D1D1F]">
                报价附件
              </h2>
            </div>
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.multiple = true;
                input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.rar";
                input.onchange = (e) => handleFileUpload(e as any);
                input.click();
              }}
              disabled={uploadingFile}
              className="px-3 py-1.5 rounded-xl border border-[#D1D1D6] text-[13px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploadingFile ? "上传中..." : "上传附件"}
            </button>
          </div>
          <p className="text-[12px] text-[#86868B] mb-3">支持上传报价单、资质文件等补充材料</p>
          {form.attachments.length > 0 ? (
            <div className="space-y-1.5">
              {form.attachments.map((att, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-[#F5F5F7]">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <File className="w-4 h-4 text-[#86868B] flex-shrink-0" />
                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#007AFF] truncate hover:underline">{att.name}</a>
                  </div>
                  <button
                    className="w-6 h-6 rounded-full hover:bg-[#E5E5EA] flex items-center justify-center flex-shrink-0"
                    onClick={() => handleRemoveAttachment(idx)}
                  >
                    <X className="w-3 h-3 text-[#86868B]" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[#86868B] text-center py-3">暂未上传附件</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5EA] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-5 h-5 text-[#007AFF]" />
            <h2 className="text-[16px] font-semibold text-[#1D1D1F]">
              提交报价
            </h2>
          </div>

          {existingQuote && (
            <div className="bg-[#FFF8E1] border border-[#FFE082] rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#FF9500] mt-0.5 shrink-0" />
              <p className="text-[13px] text-[#8B6914]">
                您已于{" "}
                {new Date(existingQuote.quotedAt!).toLocaleString("zh-CN")}{" "}
                提交过报价（总价：¥
                {existingQuote.totalPrice?.toLocaleString()}），再次提交将覆盖之前的报价
              </p>
            </div>
          )}

          {formError && (
            <div className="bg-[#FFF0F0] border border-[#FFC7C7] rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#FF3B30] mt-0.5 shrink-0" />
              <p className="text-[13px] text-[#CC0000]">{formError}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">
                选择您的公司 <span className="text-[#FF3B30]">*</span>
              </label>
              <select
                value={form.supplierId}
                onChange={(e) => {
                  const supplierId = e.target.value;
                  const quote = inquiry.supplierQuotes?.find(
                    (q) => q.supplierId === supplierId && q.quotedAt
                  );
                  let prefillQuoteItems = form.quoteItems;
                  if (quote?.items?.length) {
                    prefillQuoteItems = {};
                    for (const qi of quote.items) {
                      prefillQuoteItems[qi.purchaseRequestItemId] = {
                        unitPrice: qi.unitPrice != null ? String(qi.unitPrice) : "",
                        quantity: qi.quantity != null ? String(qi.quantity) : "",
                      };
                    }
                    for (const item of inquiry.purchaseRequest?.items || []) {
                      if (!prefillQuoteItems[item.id]) {
                        prefillQuoteItems[item.id] = { unitPrice: "", quantity: "" };
                      }
                    }
                  }
                  setForm((prev) => ({
                    ...prev,
                    supplierId,
                    quoteItems: prefillQuoteItems,
                  }));
                }}
                className="w-full px-3 py-2 rounded-xl border border-[#D1D1D6] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent bg-white"
              >
                <option value="">请选择您的公司</option>
                {inquiry.suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">
                交货天数
              </label>
              <input
                type="number"
                min="0"
                value={form.deliveryDays}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    deliveryDays: e.target.value,
                  }))
                }
                placeholder="预计交货天数"
                className="w-full px-3 py-2 rounded-xl border border-[#D1D1D6] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">
                备注
              </label>
              <textarea
                value={form.remark}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, remark: e.target.value }))
                }
                placeholder="其他补充说明（选填）"
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-[#D1D1D6] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent resize-none"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-[#007AFF] text-white px-6 py-2.5 rounded-xl font-semibold text-[14px] hover:bg-[#0056CC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
              >
                {submitting ? "提交中..." : "提交报价"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
