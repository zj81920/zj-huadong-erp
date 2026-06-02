"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, Briefcase, Plus,
  Users, Phone, Mail, MapPin, FileText,
} from "lucide-react";
import Modal from "@/components/Modal";
import BiddingSection from "./BiddingSection";
import QuotationSection from "./QuotationSection";
import { formatDate } from "./utils";

export interface Customer {
  id: string;
  name: string;
  industryType: string | null;
  contactPerson?: string | null;
  phone?: string | null;
}

export interface Bidding {
  id: string;
  projectSourceId: string;
  tenderFileReg: string | null;
  bidDeadline: string | null;
  bondAmount: number | null;
  bondPaymentStatus: string;
  bidResult: string | null;
  bidAmount: number | null;
  score: number | null;
  failReason: string | null;
  attachmentUrl: string | null;
  tenderFileUrl: string | null;
  bidFileUrl: string | null;
  description: string | null;
  tenderFiles: unknown;
  createdAt: string;
}

export interface Quotation {
  id: string;
  projectSourceId: string | null;
  customerId: string;
  estimatedCost: Record<string, unknown>;
  totalAmount: number;
  profitMargin: number | null;
  approvalStatus: string;
  status: string;
  version: number;
  adjustmentReason: string | null;
  quotationLetterUrl: string | null;
  files: unknown;
  createdAt: string;
}

export interface LeadData {
  id: string;
  projectSourceId: string;
  customerId: string;
  projectName: string;
  location: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  projectNature: string[];
  implementationEntity: string;
  infoSource: string | null;
  currentStatus: string;
  followUpRecords: unknown[];
  competitorInfo: unknown;
  tenderFiles: unknown;
  tenderNo: string | null;
  tenderDeadline: string | null;
  bondAmount: number | null;
  bondPaymentStatus: string;
  bondLendingId: string | null;
  biddingMethod: string | null;
  tenderDescription: string | null;
  createdAt: string;
  updatedAt: string;
  leadMode: string;
  customer: Customer;
  biddings: Bidding[];
  quotations: Quotation[];
}

const statusConfig: Record<string, { color: string; label: string }> = {
  "跟踪中": { color: "ios-badge-gray", label: "跟踪中" },
  "投标中": { color: "ios-badge-orange", label: "投标中" },
  "已中标": { color: "ios-badge-green", label: "已中标" },
  "报价中": { color: "ios-badge-blue", label: "报价中" },
  "落地": { color: "ios-badge-green", label: "落地" },
  "放弃": { color: "ios-badge-red", label: "放弃" },
  "已立项": { color: "ios-badge-purple", label: "已立项" },
};

interface LeadFormData {
  customerId: string;
  projectName: string;
  location: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  projectNature: string[];
  implementationEntity: string;
}

const projectNatureOptions = [
  "方案设计",
  "初步设计",
  "详细设计",
  "EPC",
  "框架协议",
  "咨询",
];

export default function ProjectLeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [lead, setLead] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLeadEditModal, setShowLeadEditModal] = useState(false);
  const [leadForm, setLeadForm] = useState<LeadFormData>({
    customerId: "", projectName: "", location: "", contactPerson: "", contactPhone: "", contactEmail: "", projectNature: [], implementationEntity: "",
  });
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ id: string; accountName: string }[]>([]);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: "", address: "", contactPerson: "", phone: "", email: "", maintainer: "", industryType: "", customerGrade: "C" });
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerError, setCustomerError] = useState("");

  const fetchLead = useCallback(async () => {
    try {
      const res = await fetch(`/api/project-leads/${id}`);
      const json = await res.json();
      if (res.ok) setLead(json.data);
    } catch (err) {
      console.error("获取线索详情失败:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

  const handleOpenLeadEdit = () => {
    if (!lead) return;
    setLeadForm({
      customerId: lead.customerId, projectName: lead.projectName,
      location: lead.location || "",
      contactPerson: lead.contactPerson || "",
      contactPhone: lead.contactPhone || "",
      contactEmail: lead.contactEmail || "",
      projectNature: lead.projectNature || [],
      implementationEntity: lead.implementationEntity || "",
    });
    setLeadError("");
    fetch("/api/customers?pageSize=200").then((r) => r.json()).then((j) => { if (j.data) setCustomers(j.data); });
    fetch("/api/bank-accounts?isActive=true&pageSize=200").then((r) => r.json()).then((j) => {
      if (j.data) {
        const companyAccounts = (j.data || []).filter(
          (a: { accountType: string }) => a.accountType === "公司账户"
        );
        setBankAccounts(companyAccounts.map((a: { id: string; accountName: string }) => ({ id: a.id, accountName: a.accountName })));
      }
    });
    setShowLeadEditModal(true);
  };

  const handleSaveLead = async () => {
    if (!lead) return;
    if (!leadForm.customerId) { setLeadError("请选择客户"); return; }
    if (!leadForm.projectName.trim()) { setLeadError("项目名称不能为空"); return; }
    if (!leadForm.projectNature || leadForm.projectNature.length === 0) { setLeadError("请选择项目性质"); return; }
    if (!leadForm.implementationEntity.trim()) { setLeadError("请选择实施主体"); return; }
    setLeadSaving(true); setLeadError("");
    try {
      const res = await fetch(`/api/project-leads/${lead.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(leadForm),
      });
      if (res.ok) { setShowLeadEditModal(false); fetchLead(); }
      else { const j = await res.json(); setLeadError(j.error || "保存失败"); }
    } catch { setLeadError("网络错误"); } finally { setLeadSaving(false); }
  };

  const handleCreateCustomer = async () => {
    if (!customerForm.name.trim()) { setCustomerError("客户名称不能为空"); return; }
    setCustomerSaving(true); setCustomerError("");
    try {
      const res = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(customerForm) });
      const json = await res.json();
      if (res.ok) {
        const custRes = await fetch("/api/customers?pageSize=200"); const custJson = await custRes.json();
        if (custJson.data) setCustomers(custJson.data);
        setLeadForm((p) => ({ ...p, customerId: json.data.id }));
        setShowCustomerModal(false);
        setCustomerForm({ name: "", address: "", contactPerson: "", phone: "", email: "", maintainer: "", industryType: "", customerGrade: "C" });
      } else { setCustomerError(json.error || "创建失败"); }
    } catch { setCustomerError("网络错误"); } finally { setCustomerSaving(false); }
  };

  if (loading) return <div className="empty-state min-h-[60vh]"><div className="w-10 h-10 border-2 border-[#111827] border-t-transparent rounded-full animate-spin" /><p>加载中...</p></div>;
  if (!lead) return <div className="empty-state min-h-[60vh]"><Briefcase className="w-8 h-8 text-[#6B7280]" /><p>项目线索不存在</p><button className="ios-btn ios-btn-primary mt-4" onClick={() => router.push("/business/project-leads")}>返回列表</button></div>;

  const sc = statusConfig[lead.currentStatus] || statusConfig["跟踪中"];
  const isEstablished = lead.currentStatus === "已立项";

  return (
    <>
      <div className="page-header">
        <div className="flex items-start gap-4">
          <button className="ios-btn ios-btn-ghost ios-btn-sm mt-1" onClick={() => router.push("/business/project-leads")}>
            <ArrowLeft className="w-4 h-4" />返回
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#111827]/10 flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-[#111827]" />
              </div>
              <div>
                <h1 className="text-[20px] font-bold text-[#111827] leading-tight">{lead.projectName}</h1>
                <p className="text-[13px] text-[#111827] font-mono font-semibold">{lead.projectSourceId}</p>
              </div>
              <span className={`ios-badge ml-2 ${sc.color}`}>{sc.label}</span>
            </div>
            {!isEstablished && (
              <div className="flex items-center gap-0.5 bg-[#F9FAFB] rounded-lg p-0.5 mt-2">
                <button
                  className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${lead.leadMode !== "商务报价" ? "bg-white text-[#111827] shadow-sm" : "text-[#6B7280]"}`}
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/project-leads/${lead.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ leadMode: "投标" }),
                      });
                      if (res.ok) fetchLead();
                      else { const j = await res.json(); alert(j.error || "切换失败"); }
                    } catch { alert("网络错误"); }
                  }}
                >投标模式</button>
                <button
                  className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${lead.leadMode === "商务报价" ? "bg-white text-[#111827] shadow-sm" : "text-[#6B7280]"}`}
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/project-leads/${lead.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ leadMode: "商务报价" }),
                      });
                      if (res.ok) fetchLead();
                      else { const j = await res.json(); alert(j.error || "切换失败"); }
                    } catch { alert("网络错误"); }
                  }}
                >报价模式</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-[#111827]/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-[#111827]" />
          </div>
          <h2 className="text-[15px] font-bold text-[#111827]">基本信息</h2>
          {!isEstablished && (
            <button className="ios-btn ios-btn-ghost ios-btn-sm ml-auto" onClick={handleOpenLeadEdit}>
              <Pencil className="w-3.5 h-3.5" />编辑
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bento-card-static"><p className="text-[12px] text-[#6B7280] mb-1">客户</p><p className="text-[15px] font-semibold text-[#111827]">{lead.customer.name}</p>{lead.customer.industryType && <span className={`ios-badge text-[10px] mt-1 ${lead.customer.industryType === "石化" ? "ios-badge-orange" : "ios-badge-green"}`}>{lead.customer.industryType}</span>}</div>
          <div className="bento-card-static"><p className="text-[12px] text-[#6B7280] mb-1">项目地点</p><p className="text-[15px] font-semibold text-[#111827]">{lead.location || "-"}</p></div>
          <div className="bento-card-static"><p className="text-[12px] text-[#6B7280] mb-1">项目联系人</p><p className="text-[15px] font-semibold text-[#111827]">{lead.contactPerson || "-"}</p></div>
          <div className="bento-card-static"><p className="text-[12px] text-[#6B7280] mb-1">联系电话</p><p className="text-[15px] font-semibold text-[#111827]">{lead.contactPhone || "-"}</p></div>
          <div className="bento-card-static"><p className="text-[12px] text-[#6B7280] mb-1">联系邮箱</p><p className="text-[15px] font-semibold text-[#111827]">{lead.contactEmail || "-"}</p></div>
          <div className="bento-card-static"><p className="text-[12px] text-[#6B7280] mb-1">项目性质</p><div className="flex flex-wrap gap-1 mt-1">{(lead.projectNature || []).map((n: string) => <span key={n} className="ios-badge text-[10px] ios-badge-blue">{n}</span>)}</div></div>
          <div className="bento-card-static"><p className="text-[12px] text-[#6B7280] mb-1">实施主体</p><p className="text-[15px] font-semibold text-[#111827]">{lead.implementationEntity || "-"}</p></div>
          <div className="bento-card-static"><p className="text-[12px] text-[#6B7280] mb-1">创建时间</p><p className="text-[15px] font-semibold text-[#111827]">{formatDate(lead.createdAt)}</p></div>
        </div>
      </div>

      {lead.leadMode !== "商务报价" ? (
        <BiddingSection lead={lead} onRefresh={fetchLead} readOnly={isEstablished} />
      ) : (
        <QuotationSection lead={lead} onRefresh={fetchLead} readOnly={isEstablished} />
      )}

      <Modal isOpen={showLeadEditModal} onClose={() => setShowLeadEditModal(false)} title="编辑项目线索" maxWidth="640px">
        <div className="space-y-4">
          {leadError && <div className="p-3 rounded-xl bg-[#6B7280]/8 text-[#6B7280] text-[13px] font-medium">{leadError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">客户 <span className="text-[#6B7280]">*</span></label>
              <select className="ios-select" value={leadForm.customerId} onChange={(e) => { setLeadForm((p) => ({ ...p, customerId: e.target.value })); if (leadError) setLeadError(""); }}>
                <option value="">请选择客户</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.industryType ? ` (${c.industryType})` : ""}</option>)}
              </select>
              <button type="button" className="ios-btn ios-btn-ghost ios-btn-sm text-[#111827] mt-1" onClick={() => { setCustomerError(""); setShowCustomerModal(true); }}>
                <Plus className="w-3.5 h-3.5" />新增客户
              </button>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">项目名称 <span className="text-[#6B7280]">*</span></label>
              <input type="text" className="ios-input" value={leadForm.projectName} onChange={(e) => setLeadForm((p) => ({ ...p, projectName: e.target.value }))} />
            </div>
            <div><label className="block text-[13px] font-semibold text-[#111827] mb-1.5">项目地点</label><input type="text" className="ios-input" value={leadForm.location} onChange={(e) => setLeadForm((p) => ({ ...p, location: e.target.value }))} /></div>
            <div><label className="block text-[13px] font-semibold text-[#111827] mb-1.5">项目联系人</label><input type="text" className="ios-input" placeholder="请输入联系人" value={leadForm.contactPerson} onChange={(e) => setLeadForm((p) => ({ ...p, contactPerson: e.target.value }))} /></div>
            <div><label className="block text-[13px] font-semibold text-[#111827] mb-1.5">联系电话</label><input type="text" className="ios-input" placeholder="请输入联系电话" value={leadForm.contactPhone} onChange={(e) => setLeadForm((p) => ({ ...p, contactPhone: e.target.value }))} /></div>
            <div><label className="block text-[13px] font-semibold text-[#111827] mb-1.5">联系邮箱</label><input type="email" className="ios-input" placeholder="请输入联系邮箱" value={leadForm.contactEmail} onChange={(e) => setLeadForm((p) => ({ ...p, contactEmail: e.target.value }))} /></div>
            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">项目性质 <span className="text-[#6B7280]">*</span></label>
              <div className="flex flex-wrap gap-2 p-2.5 border border-[#E5E7EB] rounded-xl bg-white min-h-[42px]">
                {projectNatureOptions.map((opt) => {
                  const selected = leadForm.projectNature.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all ${
                        selected ? "bg-[#111827] text-white" : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#E8E8ED]"
                      }`}
                      onClick={() => {
                        const updated = selected
                          ? leadForm.projectNature.filter((v) => v !== opt)
                          : [...leadForm.projectNature, opt];
                        setLeadForm((p) => ({ ...p, projectNature: updated }));
                        if (leadError) setLeadError("");
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">实施主体 <span className="text-[#6B7280]">*</span></label>
              <select className="ios-select" value={leadForm.implementationEntity} onChange={(e) => { setLeadForm((p) => ({ ...p, implementationEntity: e.target.value })); if (leadError) setLeadError(""); }}>
                <option value="">请选择实施主体</option>
                {bankAccounts.map((a) => <option key={a.id} value={a.accountName}>{a.accountName}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F3F4F6] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowLeadEditModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSaveLead} disabled={leadSaving}>{leadSaving ? "保存中..." : "保存修改"}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="新增客户" maxWidth="600px">
        <div className="space-y-4">
          {customerError && <div className="p-3 rounded-xl bg-[#6B7280]/8 text-[#6B7280] text-[13px] font-medium">{customerError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">客户名称 <span className="text-[#6B7280]">*</span></label>
              <input type="text" className="ios-input" placeholder="请输入客户名称" value={customerForm.name} onChange={(e) => { setCustomerForm((p) => ({ ...p, name: e.target.value })); if (customerError) setCustomerError(""); }} />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">行业类型</label>
              <select className="ios-select" value={customerForm.industryType} onChange={(e) => setCustomerForm((p) => ({ ...p, industryType: e.target.value }))}><option value="">请选择</option><option value="石化">石化</option><option value="医药">医药</option></select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">客户等级</label>
              <select className="ios-select" value={customerForm.customerGrade} onChange={(e) => setCustomerForm((p) => ({ ...p, customerGrade: e.target.value }))}><option value="A">A级（重要客户）</option><option value="B">B级（普通客户）</option><option value="C">C级（潜在客户）</option></select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">联系人</label>
              <div className="relative">
                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input type="text" className="ios-input pl-10" placeholder="联系人姓名" value={customerForm.contactPerson} onChange={(e) => setCustomerForm((p) => ({ ...p, contactPerson: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">电话</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input type="text" className="ios-input pl-10" placeholder="联系电话" value={customerForm.phone} onChange={(e) => setCustomerForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input type="email" className="ios-input pl-10" placeholder="邮箱地址" value={customerForm.email} onChange={(e) => setCustomerForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">商务责任人</label>
              <input type="text" className="ios-input" placeholder="负责商务的人员" value={customerForm.maintainer} onChange={(e) => setCustomerForm((p) => ({ ...p, maintainer: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">地址</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-[#6B7280]" />
                <input type="text" className="ios-input pl-10" placeholder="客户地址" value={customerForm.address} onChange={(e) => setCustomerForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F3F4F6] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowCustomerModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleCreateCustomer} disabled={customerSaving}>{customerSaving ? "保存中..." : "创建客户"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
