"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Eye, Calculator, DollarSign, FileText } from "lucide-react";
import Modal from "@/components/Modal";
import MultiFileUpload, { FileItem } from "@/components/MultiFileUpload";
import { LeadData, Quotation } from "./page";
import { formatDate, formatMoney } from "./utils";

interface QuotationFormData {
  totalAmount: string;
  adjustmentReason: string;
  files: FileItem[];
}

const emptyForm: QuotationFormData = {
  totalAmount: "",
  adjustmentReason: "",
  files: [],
};

function parseFiles(raw: unknown): FileItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as FileItem[];
  return [];
}

export default function QuotationSection({ lead, onRefresh, readOnly = false }: { lead: LeadData; onRefresh: () => void; readOnly?: boolean }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [form, setForm] = useState<QuotationFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detailItem, setDetailItem] = useState<Quotation | null>(null);
  const [deleteItem, setDeleteItem] = useState<Quotation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const quoteCount = lead.quotations.length;

  const areaStatus = lead.currentStatus === "落地" ? "落地" :
    lead.currentStatus === "放弃" ? "放弃" : "报价中";

  const handleAreaStatusChange = async (newStatus: string) => {
    if (newStatus === areaStatus) return;
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/project-leads/${lead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStatus: newStatus }),
      });
      if (res.ok) {
        onRefresh();
      } else {
        const j = await res.json();
        alert(j.error || "状态更新失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setStatusSaving(false);
    }
  };

  const handleOpenCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  };

  const handleOpenEdit = (q: Quotation) => {
    setEditing(q);
    setForm({
      totalAmount: String(q.totalAmount),
      adjustmentReason: q.adjustmentReason || "",
      files: parseFiles((q as Quotation & { files?: unknown }).files),
    });
    setError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.totalAmount || parseFloat(form.totalAmount) <= 0) {
      setError("报价总金额必须大于0");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const res = await fetch(`/api/quotations/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalAmount: form.totalAmount,
            adjustmentReason: form.adjustmentReason || null,
            files: form.files,
          }),
        });
        const json = await res.json();
        if (res.ok) {
          setShowModal(false);
          onRefresh();
        } else {
          setError(json.error || "操作失败");
        }
      } else {
        const res = await fetch("/api/quotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectSourceId: lead.projectSourceId,
            customerId: lead.customerId,
            totalAmount: form.totalAmount,
            adjustmentReason: form.adjustmentReason || null,
            files: form.files,
          }),
        });
        const json = await res.json();
        if (res.ok) {
          setShowModal(false);
          onRefresh();
        } else {
          setError(json.error || "操作失败");
        }
      }
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/quotations/${deleteItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteItem(null);
        onRefresh();
      } else {
        const j = await res.json();
        alert(j.error || "删除失败");
        setDeleteItem(null);
      }
    } catch {
      alert("网络错误");
      setDeleteItem(null);
    } finally {
      setDeleting(false);
    }
  };

  const updateForm = (field: keyof QuotationFormData, value: string | null) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (error) setError("");
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-[#6B7280]/10 flex items-center justify-center">
          <Calculator className="w-4 h-4 text-[#6B7280]" />
        </div>
        <h2 className="text-[15px] font-bold text-[#111827]">商务报价</h2>
        {quoteCount > 0 && (
          <span className="ios-badge text-[10px] ios-badge-blue">{quoteCount}轮</span>
        )}
        {!readOnly && (
          <button
            className="ios-btn ios-btn-primary ios-btn-sm ml-auto"
            onClick={handleOpenCreate}
          >
            <Plus className="w-3.5 h-3.5" />
            新建报价
          </button>
        )}
      </div>

      <div className="bento-card-static mb-4">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-[#111827]">报价状态:</span>
          <select
            className="ios-select !w-auto !min-w-[120px]"
            value={areaStatus}
            disabled={statusSaving || readOnly}
            onChange={(e) => handleAreaStatusChange(e.target.value)}
          >
            <option value="报价中">报价中</option>
            <option value="落地">落地</option>
            <option value="放弃">放弃</option>
          </select>
          {statusSaving && (
            <span className="text-[12px] text-[#6B7280]">保存中...</span>
          )}
        </div>
      </div>

      {quoteCount === 0 ? (
        <div className="bento-card-static">
          <div className="empty-state py-8">
            <Calculator className="w-8 h-8 text-[#6B7280]" />
            <p>暂无报价记录</p>
            <p className="text-[12px] text-[#6B7280]">点击上方按钮创建报价单</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {lead.quotations.map((q) => {
            const qFiles = parseFiles((q as Quotation & { files?: unknown }).files);
            return (
              <div key={q.id} className="bento-card-static">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#6B7280]/10 text-[12px] font-bold text-[#6B7280]">
                      v{q.version}
                    </span>
                    <span className="text-[13px] font-semibold text-[#111827]">
                      第{q.version}版报价
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="ios-btn ios-btn-ghost ios-btn-sm"
                      onClick={() => setDetailItem(q)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {!readOnly && (
                      <>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenEdit(q)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm text-[#6B7280]!"
                          onClick={() => setDeleteItem(q)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-[#F9FAFB]">
                    <p className="text-[11px] text-[#6B7280] mb-0.5">报价金额</p>
                    <p className="text-[13px] font-semibold text-[#111827]">
                      {formatMoney(q.totalAmount)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F9FAFB]">
                    <p className="text-[11px] text-[#6B7280] mb-0.5">创建时间</p>
                    <p className="text-[13px] font-semibold text-[#111827]">
                      {formatDate(q.createdAt)}
                    </p>
                  </div>
                  {q.adjustmentReason && (
                    <div className="p-2.5 rounded-xl bg-[#F9FAFB] col-span-2">
                      <p className="text-[11px] text-[#6B7280] mb-0.5">相关说明</p>
                      <p className="text-[13px] font-semibold text-[#111827]">
                        {q.adjustmentReason}
                      </p>
                    </div>
                  )}
                </div>

                {qFiles.length > 0 && (
                  <div className="pt-3 border-t border-[#F3F4F6]">
                    <p className="text-[11px] text-[#6B7280] mb-2">报价文件</p>
                    <div className="space-y-1.5">
                      {qFiles.map((f, fi) => (
                        <div
                          key={fi}
                          className="flex items-center gap-2 p-2 rounded-lg bg-[#F9FAFB]"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#111827]" />
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12px] text-[#111827] hover:underline truncate"
                          >
                            {f.name}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "编辑报价单" : "新建报价单"}
        maxWidth="640px"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[#6B7280]/8 text-[#6B7280] text-[13px] font-medium">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                报价总金额（元） <span className="text-[#6B7280]">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="number"
                  className="ios-input pl-10"
                  placeholder="报价总金额"
                  value={form.totalAmount}
                  onChange={(e) => updateForm("totalAmount", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                相关说明
              </label>
              <textarea
                className="ios-textarea"
                placeholder="请输入相关说明"
                value={form.adjustmentReason}
                onChange={(e) => updateForm("adjustmentReason", e.target.value)}
              />
            </div>
            <MultiFileUpload
              label="报价文件"
              value={form.files}
              onChange={(files) => setForm((p) => ({ ...p, files }))}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F3F4F6] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "保存中..." : editing ? "保存修改" : "创建报价单"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        title="报价单详情"
        maxWidth="680px"
      >
        {detailItem && (() => {
          const detailFiles = parseFiles((detailItem as Quotation & { files?: unknown }).files);
          return (
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-[#F3F4F6]">
                <div className="w-12 h-12 rounded-2xl bg-[#6B7280]/10 flex items-center justify-center">
                  <Calculator className="w-6 h-6 text-[#6B7280]" />
                </div>
                <div>
                  <p className="text-[17px] font-bold text-[#111827]">
                    {lead.customer.name} - 报价单
                  </p>
                  <p className="text-[13px] text-[#6B7280]">版本 v{detailItem.version}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-[#F9FAFB]">
                  <p className="text-[12px] text-[#6B7280] mb-1">关联项目</p>
                  <p className="text-[14px] font-semibold text-[#111827]">{lead.projectName}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#F9FAFB]">
                  <p className="text-[12px] text-[#6B7280] mb-1">报价总金额</p>
                  <p className="text-[14px] font-semibold text-[#111827]">
                    {formatMoney(detailItem.totalAmount)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#F9FAFB]">
                  <p className="text-[12px] text-[#6B7280] mb-1">创建时间</p>
                  <p className="text-[14px] font-semibold text-[#111827]">
                    {formatDate(detailItem.createdAt)}
                  </p>
                </div>
              </div>
              {detailItem.adjustmentReason && (
                <div className="p-3 rounded-xl bg-[#F9FAFB]">
                  <p className="text-[12px] text-[#6B7280] mb-1">相关说明</p>
                  <p className="text-[14px] font-semibold text-[#111827]">
                    {detailItem.adjustmentReason}
                  </p>
                </div>
              )}
              {detailFiles.length > 0 && (
                <div>
                  <p className="text-[12px] text-[#6B7280] mb-2">报价文件</p>
                  <div className="space-y-2">
                    {detailFiles.map((f, fi) => (
                      <div
                        key={fi}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F9FAFB]"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#111827]/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-[#111827]" />
                        </div>
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] text-[#111827] hover:underline truncate"
                        >
                          {f.name}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      <Modal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        title="确认删除"
        maxWidth="400px"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#6B7280]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#6B7280]" />
          </div>
          <p className="text-[15px] text-[#111827] mb-1">确定要删除该报价单吗？</p>
          <p className="text-[13px] text-[#6B7280] mb-6">此操作不可撤销</p>
          <div className="flex justify-center gap-3">
            <button className="ios-btn ios-btn-secondary" onClick={() => setDeleteItem(null)}>
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
    </div>
  );
}
