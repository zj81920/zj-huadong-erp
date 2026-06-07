"use client";

import React, { useState } from "react";
import CounterpartySearch from "@/components/CounterpartySearch";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Trophy,
  FileText,
  FolderOpen,
  DollarSign,
  Calendar,
  Shield,
  Sparkles,
  Loader2,
  Send,
} from "lucide-react";
import Modal from "@/components/Modal";
import MultiFileUpload, { FileItem } from "@/components/MultiFileUpload";
import { LeadData, Bidding } from "./page";
import { formatDate, formatMoney } from "./utils";

interface TenderFormData {
  tenderNo: string;
  tenderDeadline: string;
  bondAmount: string;
  biddingMethod: string;
  tenderDescription: string;
  tenderFiles: FileItem[];
}

const emptyTender: TenderFormData = {
  tenderNo: "",
  tenderDeadline: "",
  bondAmount: "",
  biddingMethod: "",
  tenderDescription: "",
  tenderFiles: [],
};

interface BiddingFormData {
  bidAmount: string;
  description: string;
  tenderFiles: FileItem[];
}

const emptyBid: BiddingFormData = {
  bidAmount: "",
  description: "",
  tenderFiles: [],
};

function parseFiles(raw: unknown): FileItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as FileItem[];
  return [];
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactElement[] = [];
  let inList = false;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc pl-5 mb-2 space-y-1">
          {listItems.map((li, i) => (
            <li key={i} className="text-[13px] text-[#1C1917] leading-relaxed">
              {li.replace(/`([^`]+)`/g, "$1")}
            </li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, idx) => {
    const h3Match = line.match(/^###\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);
    const h1Match = line.match(/^#\s+(.+)/);
    const liMatch = line.match(/^[-*]\s+(.+)/);
    const boldLine = line.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

    if (h1Match) {
      flushList();
      elements.push(
        <h2 key={idx} className="text-[16px] font-bold text-[#1C1917] mt-4 mb-2">
          {h1Match[1]}
        </h2>
      );
    } else if (h2Match) {
      flushList();
      elements.push(
        <h3 key={idx} className="text-[14px] font-bold text-[#1C1917] mt-3 mb-1.5 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#1C1917]" />
          {h2Match[1]}
        </h3>
      );
    } else if (h3Match) {
      flushList();
      elements.push(
        <h4 key={idx} className="text-[13px] font-bold text-[#1C1917] mt-2 mb-1">
          {h3Match[1]}
        </h4>
      );
    } else if (liMatch) {
      inList = true;
      listItems.push(liMatch[1]);
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      const escaped = boldLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      elements.push(
        <p
          key={idx}
          className="text-[13px] text-[#1C1917] leading-relaxed mb-1"
          dangerouslySetInnerHTML={{ __html: escaped.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>") }}
        />
      );
    }
  });
  flushList();

  return <div>{elements}</div>;
}

export default function BiddingSection({
  lead,
  onRefresh,
  readOnly = false,
}: {
  lead: LeadData;
  onRefresh: () => void;
  readOnly?: boolean;
}) {
  const [showTenderModal, setShowTenderModal] = useState(false);
  const [tenderForm, setTenderForm] = useState<TenderFormData>(emptyTender);
  const [savingTender, setSavingTender] = useState(false);
  const [tenderError, setTenderError] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  const [showBondModal, setShowBondModal] = useState(false);
  const [bondSaving, setBondSaving] = useState(false);
  const [bondForm, setBondForm] = useState({
    counterpartyName: "",
    bankName: "",
    bankAccount: "",
  });

  const [showBidModal, setShowBidModal] = useState(false);
  const [editingBid, setEditingBid] = useState<Bidding | null>(null);
  const [bidForm, setBidForm] = useState<BiddingFormData>(emptyBid);
  const [savingBid, setSavingBid] = useState(false);
  const [bidError, setBidError] = useState("");

  const [detailItem, setDetailItem] = useState<Bidding | null>(null);
  const [deleteItem, setDeleteItem] = useState<Bidding | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const bidCount = lead.biddings.length;
  const leadTenderFiles = parseFiles(lead.tenderFiles);
  const hasTenderInfo =
    lead.tenderNo ||
    lead.tenderDeadline ||
    lead.bondAmount ||
    lead.biddingMethod ||
    lead.tenderDescription ||
    leadTenderFiles.length > 0;

  const biddingAreaStatus =
    lead.currentStatus === "已中标"
      ? "已中标"
      : lead.currentStatus === "未中标"
        ? "未中标"
        : lead.currentStatus === "放弃"
          ? "放弃"
          : "投标中";

  const handleAreaStatusChange = async (newStatus: string) => {
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/project-leads/${lead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStatus: newStatus }),
      });
      if (res.ok) onRefresh();
      else {
        const j = await res.json();
        alert(j.error || "状态更新失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setStatusSaving(false);
    }
  };

  const handleOpenTenderModal = () => {
    setTenderForm({
      tenderNo: lead.tenderNo || "",
      tenderDeadline: lead.tenderDeadline
        ? lead.tenderDeadline.split("T")[0]
        : "",
      bondAmount: lead.bondAmount ? String(lead.bondAmount) : "",
      biddingMethod: lead.biddingMethod || "",
      tenderDescription: lead.tenderDescription || "",
      tenderFiles: leadTenderFiles,
    });
    setTenderError("");
    setAnalyzeError("");
    setShowTenderModal(true);
  };

  const handleSaveTender = async () => {
    setSavingTender(true);
    setTenderError("");
    try {
      const res = await fetch(`/api/project-leads/${lead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenderFiles: tenderForm.tenderFiles,
          tenderNo: tenderForm.tenderNo || null,
          tenderDeadline: tenderForm.tenderDeadline || null,
          bondAmount: tenderForm.bondAmount || null,
          biddingMethod: tenderForm.biddingMethod || null,
          tenderDescription: tenderForm.tenderDescription || null,
        }),
      });
      if (res.ok) {
        setShowTenderModal(false);
        onRefresh();
      } else {
        const j = await res.json();
        setTenderError(j.error || "保存失败");
      }
    } catch {
      setTenderError("网络错误");
    } finally {
      setSavingTender(false);
    }
  };

  const handleAIAnalyze = async () => {
    if (tenderForm.tenderFiles.length === 0) {
      setAnalyzeError("请先上传招标文件");
      return;
    }
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const urls = tenderForm.tenderFiles.map((f) => f.url);
      const res = await fetch("/api/ai/analyze-tender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrls: urls }),
      });
      const json = await res.json();
      if (res.ok) {
        setTenderForm((p) => ({ ...p, tenderDescription: json.data }));
      } else {
        setAnalyzeError(json.error || "AI 解析失败");
      }
    } catch {
      setAnalyzeError("网络错误，请重试");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateBondPayment = async () => {
    setBondSaving(true);
    try {
      const res = await fetch("/api/project-leads/bond-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          projectSourceId: lead.projectSourceId,
          borrowerName: bondForm.counterpartyName || lead.customer?.name || "",
          amount: lead.bondAmount ? Number(lead.bondAmount) : 0,
          description: `${lead.projectName} - 投标保证金`,
          bankName: bondForm.bankName || null,
          bankAccount: bondForm.bankAccount || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        if (json.warning) {
          alert(json.warning);
        }
        setShowBondModal(false);
        onRefresh();
      } else {
        alert(json.error || "创建支付失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setBondSaving(false);
    }
  };

  const handleOpenBidCreate = () => {
    setEditingBid(null);
    setBidForm(emptyBid);
    setBidError("");
    setShowBidModal(true);
  };

  const handleOpenBidEdit = (b: Bidding) => {
    setEditingBid(b);
    setBidForm({
      bidAmount: b.bidAmount ? String(b.bidAmount) : "",
      description:
        (b as Bidding & { description?: string }).description || "",
      tenderFiles: parseFiles(
        (b as Bidding & { tenderFiles?: unknown }).tenderFiles
      ),
    });
    setBidError("");
    setShowBidModal(true);
  };

  const handleBidSubmit = async () => {
    setSavingBid(true);
    setBidError("");
    try {
      const payload: Record<string, unknown> = {
        projectSourceId: lead.projectSourceId,
        bidAmount: bidForm.bidAmount ? parseFloat(bidForm.bidAmount) : null,
        description: bidForm.description?.trim() || null,
        tenderFiles: bidForm.tenderFiles,
      };
      const url = editingBid
        ? `/api/biddings/${editingBid.id}`
        : "/api/biddings";
      const method = editingBid ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setShowBidModal(false);
        onRefresh();
      } else {
        setBidError(json.error || "操作失败");
      }
    } catch {
      setBidError("网络错误");
    } finally {
      setSavingBid(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/biddings/${deleteItem.id}`, {
        method: "DELETE",
      });
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

  const bondStatusColor: Record<string, string> = {
    "未付": "ios-badge-gray",
    "审批中": "ios-badge-orange",
    "已付": "ios-badge-green",
    "已退": "ios-badge-blue",
  };

  return (
    <div className="mb-8">
      {/* 投标状态栏 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-[#78716C]/10 flex items-center justify-center">
          <Trophy className="w-4 h-4 text-[#78716C]" />
        </div>
        <h2 className="text-[15px] font-bold text-[#1C1917]">投标管理</h2>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-[13px] font-semibold text-[#1C1917]">
            投标状态:
          </span>
          <select
            className="ios-select text-[13px] py-1.5 px-3"
            value={biddingAreaStatus}
            onChange={(e) => handleAreaStatusChange(e.target.value)}
            disabled={statusSaving || readOnly}
          >
            <option value="投标中">投标中</option>
            <option value="已中标">已中标</option>
            <option value="未中标">未中标</option>
          </select>
        </div>
      </div>

      {/* 招标资料区 */}
      <div className="bento-card-static mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#1C1917]/10 flex items-center justify-center">
              <FolderOpen className="w-3.5 h-3.5 text-[#1C1917]" />
            </div>
            <span className="text-[14px] font-semibold text-[#1C1917]">
              招标资料
            </span>
          </div>
          {!readOnly && (
            <button
              className="ios-btn ios-btn-primary ios-btn-sm"
              onClick={handleOpenTenderModal}
            >
              <Pencil className="w-3.5 h-3.5" />
              编辑招标资料
            </button>
          )}
        </div>

        {!hasTenderInfo ? (
          <div className="empty-state py-6">
            <FolderOpen className="w-6 h-6 text-[#78716C]" />
            <p className="text-[13px]">暂无招标资料</p>
            <p className="text-[12px] text-[#78716C]">
              点击上方按钮填写招标信息
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {lead.tenderNo && (
                <div className="p-2.5 rounded-xl bg-[#FAFAF9]">
                  <p className="text-[11px] text-[#78716C] mb-0.5">招标编号</p>
                  <p className="text-[13px] font-semibold text-[#1C1917] font-mono">
                    {lead.tenderNo}
                  </p>
                </div>
              )}
              {lead.tenderDeadline && (
                <div className="p-2.5 rounded-xl bg-[#FAFAF9]">
                  <p className="text-[11px] text-[#78716C] mb-0.5">截止日期</p>
                  <p className="text-[13px] font-semibold text-[#1C1917]">
                    {formatDate(lead.tenderDeadline)}
                  </p>
                </div>
              )}
              {lead.biddingMethod && (
                <div className="p-2.5 rounded-xl bg-[#FAFAF9]">
                  <p className="text-[11px] text-[#78716C] mb-0.5">投标方式</p>
                  <p className="text-[13px] font-semibold text-[#1C1917]">
                    {lead.biddingMethod}
                  </p>
                </div>
              )}
              <div className="p-2.5 rounded-xl bg-[#FAFAF9]">
                <p className="text-[11px] text-[#78716C] mb-0.5">投标保证金</p>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[#1C1917]">
                    {formatMoney(lead.bondAmount)}
                  </span>
                  <span
                    className={`ios-badge text-[10px] ${bondStatusColor[lead.bondPaymentStatus] || "ios-badge-gray"}`}
                  >
                    {lead.bondPaymentStatus}
                  </span>
                </div>
                {!readOnly && lead.bondAmount &&
                  Number(lead.bondAmount) > 0 &&
                  lead.bondPaymentStatus === "未付" && (
                    <button
                      className="mt-2 ios-btn ios-btn-primary ios-btn-sm"
                      onClick={() => { setBondForm({ counterpartyName: lead.customer?.name || "", bankName: "", bankAccount: "" }); setShowBondModal(true); }}
                    >
                      <Send className="w-3 h-3" />
                      发起保证金支付
                    </button>
                  )}
              </div>
            </div>

            {leadTenderFiles.length > 0 && (
              <div className="pt-3 border-t border-[#F5F5F4]">
                <p className="text-[11px] text-[#78716C] mb-2">招标文件</p>
                <div className="space-y-1.5">
                  {leadTenderFiles.map((f, fi) => (
                    <div
                      key={fi}
                      className="flex items-center gap-2 p-2 rounded-lg bg-[#FAFAF9]"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#1C1917]" />
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-[#1C1917] hover:underline truncate"
                      >
                        {f.name}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lead.tenderDescription && (
              <div className="pt-3 border-t border-[#F5F5F4]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3 h-3 text-[#78716C]" />
                  <p className="text-[11px] text-[#78716C]">招标文件说明</p>
                </div>
                <div className="p-3 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4]">
                  <MarkdownRenderer content={lead.tenderDescription} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 投标记录区 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[14px] font-semibold text-[#1C1917]">
            投标记录
          </span>
          {bidCount > 0 && (
            <span className="ios-badge text-[10px] ios-badge-orange">
              {bidCount}轮
            </span>
          )}
          {!readOnly && (
            <button
              className="ios-btn ios-btn-primary ios-btn-sm ml-auto"
              onClick={handleOpenBidCreate}
            >
              <Plus className="w-3.5 h-3.5" />
              新增投标
            </button>
          )}
        </div>

        {bidCount === 0 ? (
          <div className="bento-card-static">
            <div className="empty-state py-6">
              <Trophy className="w-6 h-6 text-[#78716C]" />
              <p className="text-[13px]">暂无投标记录</p>
              <p className="text-[12px] text-[#78716C]">
                点击上方按钮添加投标
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {lead.biddings.map((b, idx) => {
              const files = parseFiles(
                (b as Bidding & { tenderFiles?: unknown }).tenderFiles
              );
              const desc = (b as Bidding & { description?: string })
                .description;
              return (
                <div key={b.id} className="bento-card-static">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#78716C]/10 text-[12px] font-bold text-[#78716C]">
                        {idx + 1}
                      </span>
                      <span className="text-[13px] font-semibold text-[#1C1917]">
                        第{idx + 1}轮投标
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="ios-btn ios-btn-ghost ios-btn-sm"
                        onClick={() => setDetailItem(b)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {!readOnly && (
                        <>
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => handleOpenBidEdit(b)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                            onClick={() => setDeleteItem(b)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-[#FAFAF9]">
                      <p className="text-[11px] text-[#78716C] mb-0.5">
                        投标报价
                      </p>
                      <p className="text-[13px] font-semibold text-[#1C1917]">
                        {formatMoney(b.bidAmount)}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#FAFAF9]">
                      <p className="text-[11px] text-[#78716C] mb-0.5">
                        投标时间
                      </p>
                      <p className="text-[13px] font-semibold text-[#1C1917]">
                        {formatDate(b.createdAt)}
                      </p>
                    </div>
                    {desc && (
                      <div className="p-2.5 rounded-xl bg-[#FAFAF9] col-span-2">
                        <p className="text-[11px] text-[#78716C] mb-0.5">
                          情况说明
                        </p>
                        <p className="text-[13px] font-semibold text-[#1C1917]">
                          {desc}
                        </p>
                      </div>
                    )}
                  </div>
                  {files.length > 0 && (
                    <div className="pt-3 border-t border-[#F5F5F4]">
                      <p className="text-[11px] text-[#78716C] mb-2">
                        投标文件
                      </p>
                      <div className="space-y-1.5">
                        {files.map((f, fi) => (
                          <div
                            key={fi}
                            className="flex items-center gap-2 p-2 rounded-lg bg-[#FAFAF9]"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#1C1917]" />
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[12px] text-[#1C1917] hover:underline truncate"
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
      </div>

      {/* 招标资料编辑弹窗 */}
      <Modal
        isOpen={showTenderModal}
        onClose={() => setShowTenderModal(false)}
        title="编辑招标资料"
        maxWidth="720px"
      >
        <div className="space-y-4">
          {tenderError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {tenderError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                招标编号
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="招标编号"
                value={tenderForm.tenderNo}
                onChange={(e) =>
                  setTenderForm((p) => ({ ...p, tenderNo: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                截止日期
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="date"
                  className="ios-input pl-10"
                  value={tenderForm.tenderDeadline}
                  onChange={(e) =>
                    setTenderForm((p) => ({
                      ...p,
                      tenderDeadline: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                投标保证金（元）
              </label>
              <div className="relative">
                <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="number"
                  className="ios-input pl-10"
                  placeholder="保证金金额"
                  value={tenderForm.bondAmount}
                  onChange={(e) =>
                    setTenderForm((p) => ({ ...p, bondAmount: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                投标方式
              </label>
              <select
                className="ios-select"
                value={tenderForm.biddingMethod}
                onChange={(e) =>
                  setTenderForm((p) => ({
                    ...p,
                    biddingMethod: e.target.value,
                  }))
                }
              >
                <option value="">请选择</option>
                <option value="线上">线上</option>
                <option value="线下">线下</option>
              </select>
            </div>
          </div>
          <MultiFileUpload
            label="招标文件"
            value={tenderForm.tenderFiles}
            onChange={(files) =>
              setTenderForm((p) => ({ ...p, tenderFiles: files }))
            }
          />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[13px] font-semibold text-[#1C1917]">
                招标文件说明
              </label>
              <button
                className="ios-btn ios-btn-sm"
                style={{
                  background: "linear-gradient(135deg, #78716C, #1C1917)",
                  color: "#fff",
                  border: "none",
                }}
                onClick={handleAIAnalyze}
                disabled={analyzing || tenderForm.tenderFiles.length === 0}
              >
                {analyzing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {analyzing ? "AI 解析中..." : "AI 智能解析"}
              </button>
            </div>
            {analyzeError && (
              <p className="text-[12px] text-[#78716C] mb-1">{analyzeError}</p>
            )}
            <textarea
              className="ios-textarea"
              style={{ minHeight: "200px" }}
              placeholder="招标文件要点说明（支持 Markdown 格式，可点击 AI 智能解析自动生成）"
              value={tenderForm.tenderDescription}
              onChange={(e) =>
                setTenderForm((p) => ({
                  ...p,
                  tenderDescription: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowTenderModal(false)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleSaveTender}
              disabled={savingTender}
            >
              {savingTender ? "保存中..." : "保存招标资料"}
            </button>
          </div>
        </div>
      </Modal>

      {/* 保证金支付确认弹窗 */}
      <Modal
        isOpen={showBondModal}
        onClose={() => setShowBondModal(false)}
        title="发起保证金支付"
        maxWidth="480px"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#FAFAF9]">
            <p className="text-[12px] text-[#78716C] mb-1">保证金金额</p>
            <p className="text-[20px] font-bold text-[#1C1917]">
              {formatMoney(lead.bondAmount)}
            </p>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">交易对方名称 <span className="text-[#78716C]">*</span></label>
            <CounterpartySearch
              value={bondForm.counterpartyName}
              onChange={(name) => setBondForm((p) => ({ ...p, counterpartyName: name }))}
              onSelect={(bank) => setBondForm((p) => ({ ...p, bankName: bank.bankName, bankAccount: bank.bankAccount }))}
              placeholder="请输入收款方名称"
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">开户行</label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入开户行"
              value={bondForm.bankName}
              onChange={(e) => setBondForm((p) => ({ ...p, bankName: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">银行账号</label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入银行账号"
              value={bondForm.bankAccount}
              onChange={(e) => setBondForm((p) => ({ ...p, bankAccount: e.target.value }))}
            />
          </div>
          <p className="text-[13px] text-[#78716C]">
            点击确认后将自动创建借出款记录并提交审批流程。审批通过后保证金状态将自动更新为「已付」；如被驳回则显示「已退回」，可重新发起。
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowBondModal(false)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleCreateBondPayment}
              disabled={bondSaving}
            >
              {bondSaving ? "提交中..." : "确认发起支付"}
            </button>
          </div>
        </div>
      </Modal>

      {/* 新增/编辑投标弹窗 */}
      <Modal
        isOpen={showBidModal}
        onClose={() => setShowBidModal(false)}
        title={editingBid ? "编辑投标记录" : "新增投标"}
        maxWidth="640px"
      >
        <div className="space-y-4">
          {bidError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {bidError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                投标报价（元）
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="number"
                  className="ios-input pl-10"
                  placeholder="投标报价金额"
                  value={bidForm.bidAmount}
                  onChange={(e) =>
                    setBidForm((p) => ({ ...p, bidAmount: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                情况说明
              </label>
              <textarea
                className="ios-textarea"
                placeholder="请输入情况说明"
                value={bidForm.description}
                onChange={(e) =>
                  setBidForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
            <MultiFileUpload
              label="投标文件"
              value={bidForm.tenderFiles}
              onChange={(files) =>
                setBidForm((p) => ({ ...p, tenderFiles: files }))
              }
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowBidModal(false)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleBidSubmit}
              disabled={savingBid}
            >
              {savingBid
                ? "保存中..."
                : editingBid
                  ? "保存修改"
                  : "创建投标记录"}
            </button>
          </div>
        </div>
      </Modal>

      {/* 投标详情弹窗 */}
      <Modal
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        title="投标详情"
        maxWidth="680px"
      >
        {detailItem && (() => {
          const detailFiles = parseFiles(
            (detailItem as Bidding & { tenderFiles?: unknown }).tenderFiles
          );
          const detailDesc = (detailItem as Bidding & { description?: string })
            .description;
          return (
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-[#F5F5F4]">
                <div className="w-12 h-12 rounded-2xl bg-[#78716C]/10 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-[#78716C]" />
                </div>
                <div>
                  <p className="text-[17px] font-bold text-[#1C1917]">
                    {lead.projectName}
                  </p>
                  <p className="text-[13px] text-[#1C1917] font-mono font-semibold">
                    {lead.projectSourceId}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-[#FAFAF9]">
                  <p className="text-[12px] text-[#78716C] mb-1">客户</p>
                  <p className="text-[14px] font-semibold text-[#1C1917]">
                    {lead.customer?.name}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#FAFAF9]">
                  <p className="text-[12px] text-[#78716C] mb-1">投标报价</p>
                  <p className="text-[14px] font-semibold text-[#1C1917]">
                    {formatMoney(detailItem.bidAmount)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#FAFAF9]">
                  <p className="text-[12px] text-[#78716C] mb-1">投标时间</p>
                  <p className="text-[14px] font-semibold text-[#1C1917]">
                    {formatDate(detailItem.createdAt)}
                  </p>
                </div>
              </div>
              {detailDesc && (
                <div className="p-3 rounded-xl bg-[#FAFAF9]">
                  <p className="text-[12px] text-[#78716C] mb-1">情况说明</p>
                  <p className="text-[14px] font-semibold text-[#1C1917]">
                    {detailDesc}
                  </p>
                </div>
              )}
              {detailFiles.length > 0 && (
                <div>
                  <p className="text-[12px] text-[#78716C] mb-2">投标文件</p>
                  <div className="space-y-2">
                    {detailFiles.map((f, fi) => (
                      <div
                        key={fi}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FAFAF9]"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-[#1C1917]" />
                        </div>
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] text-[#1C1917] hover:underline truncate"
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

      {/* 删除确认弹窗 */}
      <Modal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        title="确认删除"
        maxWidth="400px"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#78716C]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#78716C]" />
          </div>
          <p className="text-[15px] text-[#1C1917] mb-1">
            确定要删除该投标记录吗？
          </p>
          <p className="text-[13px] text-[#78716C] mb-6">此操作不可撤销</p>
          <div className="flex justify-center gap-3">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setDeleteItem(null)}
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
    </div>
  );
}
