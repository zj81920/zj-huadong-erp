"use client";

import React, { useState, useRef, useEffect } from "react";
import { CheckCircle, XCircle, Clock, FileText, ChevronDown, ChevronUp, MessageSquare, Send, X, SkipForward, Upload, FileCheck, Archive, CreditCard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface FlowNode {
  nodeOrder: number;
  nodeName: string;
  approverRole: string;
  nodeType?: string;
}

interface ActionRecord {
  id: string;
  nodeId: number;
  nodeName: string;
  action: string;
  comment: string | null;
  actedAt: string | null;
  signatureUrl: string | null;
  approver: { id: string; realName: string; username: string };
}

interface InstanceDetail {
  id: string;
  businessType: string;
  businessId: string;
  status: string;
  currentNode: number;
  createdAt: string;
  actions: ActionRecord[];
  flowNodes: FlowNode[];
}

interface ApprovalStatusBadgeProps {
  status: string;
}

export function ApprovalStatusBadge({ status }: ApprovalStatusBadgeProps) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    "草稿": { bg: "bg-gray-100", text: "text-gray-600", label: "草稿" },
    "审批中": { bg: "bg-blue-50", text: "text-blue-600", label: "审批中" },
    "已批准": { bg: "bg-green-50", text: "text-green-600", label: "已批准" },
    "已驳回": { bg: "bg-red-50", text: "text-red-600", label: "已驳回" },
    "待归档": { bg: "bg-amber-50", text: "text-amber-600", label: "待归档" },
    "已归档": { bg: "bg-purple-50", text: "text-purple-600", label: "已归档" },
    "待支付": { bg: "bg-amber-50", text: "text-amber-600", label: "待支付" },
    "已支付": { bg: "bg-teal-50", text: "text-teal-600", label: "已支付" },
    "合同归档": { bg: "bg-purple-50", text: "text-purple-600", label: "合同归档" },
    "未还清": { bg: "bg-orange-50", text: "text-orange-600", label: "未还清" },
    "已还清": { bg: "bg-green-50", text: "text-green-600", label: "已还清" },
  };

  const c = config[status] || { bg: "bg-gray-100", text: "text-gray-600", label: status };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {status === "审批中" && <Clock className="w-3 h-3" />}
      {status === "已批准" && <CheckCircle className="w-3 h-3" />}
      {status === "已驳回" && <XCircle className="w-3 h-3" />}
      {(status === "待归档" || status === "已归档") && <Archive className="w-3 h-3" />}
      {(status === "待支付" || status === "已支付") && <CreditCard className="w-3 h-3" />}
      {c.label}
    </span>
  );
}

function SignatureImage({ src, name }: { src: string; name?: string }) {
  const [enlarged, setEnlarged] = useState(false);

  return (
    <>
      <img
        src={src}
        alt={`${name || ""}签名`}
        className="max-h-[32px] max-w-[100px] object-contain cursor-pointer hover:opacity-80 transition-opacity rounded"
        onClick={() => setEnlarged(true)}
      />
      {enlarged && (
        <div
          className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center"
          onClick={() => setEnlarged(false)}
        >
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[#1C1917]">{name ? `${name}的签名` : "电子签名"}</span>
              <button onClick={() => setEnlarged(false)} className="text-[#78716C] hover:text-[#1C1917]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <img src={src} alt="签名" className="max-h-[200px] max-w-full object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

/** 审批详情信息面板 - 展示当前节点/提交人/优先级/节点类型/提交时间 */
export function ApprovalInfoPanel({ instance }: { instance: InstanceDetail | null }) {
  if (!instance) return null;

  const { flowNodes = [], actions = [], currentNode, status, createdAt } = instance;
  const initiateAction = actions.find((a) => a.action === "initiate");
  const initiatorName = initiateAction?.approver?.realName || "—";

  const currentNodeDef = flowNodes.find((n) => n.nodeOrder === currentNode);
  const nodeName = currentNodeDef?.nodeName || "—";
  const nodeType = currentNodeDef?.nodeType || "approval";

  const diff = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(diff / 3600000);
  const priorityLabel = hours >= 48 ? "紧急" : hours >= 24 ? "重要" : "普通";
  const priorityClass = hours >= 48 ? "ios-badge ios-badge-red" : hours >= 24 ? "ios-badge ios-badge-yellow" : "ios-badge ios-badge-gray";
  const nodeTypeLabel = nodeType === "archive" ? "归档" : nodeType === "payment" ? "支付" : "审批";

  return (
    <div className="grid grid-cols-2 gap-3 bg-[#FAFAF9] rounded-lg p-3 text-[13px]">
      <div className="flex items-center gap-2">
        <span className="text-[#78716C]">当前节点</span>
        <span className="font-medium text-[#1C1917]">{status === "已驳回" ? "已驳回" : nodeName}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[#78716C]">提交人</span>
        <span className="font-medium text-[#1C1917]">{initiatorName}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[#78716C]">优先级</span>
        <span className={priorityClass}>{priorityLabel}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[#78716C]">节点类型</span>
        <span className="ios-badge ios-badge-gray">{nodeTypeLabel}</span>
      </div>
      <div className="flex items-center gap-2 col-span-2">
        <span className="text-[#78716C]">提交时间</span>
        <span className="font-medium text-[#1C1917]">{new Date(createdAt).toLocaleString("zh-CN")}</span>
      </div>
    </div>
  );
}

interface ApprovalTimelineProps {
  instance: InstanceDetail | null;
  loading?: boolean;
}

export function ApprovalTimeline({ instance, loading }: ApprovalTimelineProps) {
  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <div className="bento-card-static p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!instance) return null;

  const { flowNodes = [], actions = [], currentNode, status } = instance;

  // 获取发起人信息（从 initiate action 中提取）
  const initiateAction = actions.find((a) => a.action === "initiate");
  const initiatorName = initiateAction?.approver?.realName || "—";
  const initiatorTime = initiateAction?.actedAt;

  const getActionForNode = (nodeOrder: number) => {
    return actions.filter((a) => a.nodeId === nodeOrder && a.action !== "initiate" && a.action !== "resubmit");
  };

  const getNodeStatus = (nodeOrder: number): "done" | "current" | "pending" | "rejected" => {
    if (status === "已驳回") {
      const rejectAction = actions.find((a) => a.action === "reject");
      if (rejectAction) {
        if (nodeOrder === rejectAction.nodeId) return "rejected";
        if (nodeOrder < rejectAction.nodeId) return "done";
      }
      if (nodeOrder < currentNode) return "done";
      if (nodeOrder === currentNode) return "rejected";
      return "pending";
    }
    if (nodeOrder < currentNode) return "done";
    if (nodeOrder === currentNode && status === "审批中") return "current";
    if (status === "已批准" || status === "合同归档") return "done";
    return "pending";
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "approve": return "通过";
      case "reject": return "驳回";
      case "auto_skip": return "自动跳过";
      case "resubmit": return "重新提交";
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "approve": return "text-[#78716C]";
      case "reject": return "text-[#78716C]";
      case "auto_skip": return "text-[#78716C]";
      case "resubmit": return "text-[#2563EB]";
      default: return "text-[#78716C]";
    }
  };

  const formatActionTime = (actedAt: string | null) => {
    if (!actedAt) return "";
    const d = new Date(actedAt);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${month}-${day} ${hour}:${min}`;
  };

  return (
    <div className="bento-card-static p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-[#1C1917] w-full cursor-pointer"
      >
        <FileText className="w-4 h-4 text-[#1C1917]" />
        审批流程
        <ApprovalStatusBadge status={status} />
        <span className="ml-auto">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {/* 流程发起人行 */}
          <div className="rounded-xl border-l-[3px] border-l-[#1C1917] bg-[#FAFAF9] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white bg-[#1C1917] shrink-0">
                <Send className="w-3.5 h-3.5" />
              </div>
              <span className="text-[13px] font-semibold text-[#1C1917]">
                流程发起人：{initiatorName}
              </span>
              {initiatorTime && (
                <span className="text-[11px] text-[#78716C]">
                  {formatActionTime(initiatorTime)}
                </span>
              )}
            </div>
          </div>

          {/* 重新提交记录 */}
          {actions.filter((a) => a.action === "resubmit").map((ra) => (
            <div key={ra.id}>
              <div className="rounded-xl border-l-[3px] border-l-[#2563EB] bg-[#EFF6FF] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white bg-[#2563EB] shrink-0">
                    <Send className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[13px] font-semibold text-[#2563EB]">
                    重新提交：{ra.approver?.realName || "—"}
                  </span>
                  {ra.actedAt && (
                    <span className="text-[11px] text-[#78716C]">
                      {formatActionTime(ra.actedAt)}
                    </span>
                  )}
                </div>
                {ra.comment && (
                  <div className="mt-1.5 ml-8.5 flex items-start gap-1.5">
                    <MessageSquare className="w-3 h-3 text-[#78716C] shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#48484A] bg-white/60 rounded-lg px-2.5 py-1.5 border border-[#E7E5E4]">
                      {ra.comment}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-center py-1">
                <div className="w-0.5 h-3 rounded-full bg-[#78716C]" />
              </div>
            </div>
          ))}

          {/* 发起人与审批节点之间的连接线 */}
          {flowNodes.length > 0 && (
            <div className="flex justify-center py-1">
              <div className="w-0.5 h-3 rounded-full bg-[#78716C]" />
            </div>
          )}

          {flowNodes.map((node, idx) => {
            const nodeStatus = getNodeStatus(node.nodeOrder);
            const nodeActions = getActionForNode(node.nodeOrder);
            const isLast = idx === flowNodes.length - 1;

            const borderColor =
              nodeStatus === "done" ? "border-l-[#78716C]" :
              nodeStatus === "current" ? "border-l-[#1C1917]" :
              nodeStatus === "rejected" ? "border-l-[#78716C]" :
              "border-l-[#D1D5DB]";

            const bgColor =
              nodeStatus === "done" ? "bg-[#F0FDF4]" :
              nodeStatus === "current" ? "bg-[#EFF6FF]" :
              nodeStatus === "rejected" ? "bg-[#FEF2F2]" :
              "bg-[#FAFAF9]";

            const iconBg =
              nodeStatus === "done" ? "bg-[#78716C]" :
              nodeStatus === "current" ? "bg-[#1C1917]" :
              nodeStatus === "rejected" ? "bg-[#78716C]" :
              "bg-[#D1D5DB]";

            const iconContent =
              nodeStatus === "done" ? <CheckCircle className="w-3.5 h-3.5" /> :
              nodeStatus === "current" ? (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                </span>
              ) :
              nodeStatus === "rejected" ? <XCircle className="w-3.5 h-3.5" /> :
              <span className="text-[10px] font-semibold">{idx + 1}</span>;

            return (
              <div key={node.nodeOrder}>
                <div
                  className={`rounded-xl border-l-[3px] ${borderColor} ${bgColor} px-4 py-3 transition-all`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0 ${iconBg}`}>
                        {iconContent}
                      </div>
                      <span className={`text-[13px] font-semibold ${
                        nodeStatus === "pending" ? "text-[#78716C]" : "text-[#1C1917]"
                      }`}>
                        {node.nodeName}
                      </span>
                    </div>
                    {nodeStatus === "pending" && (
                      <span className="text-[11px] text-[#78716C]">等待审批</span>
                    )}
                  </div>

                  {nodeActions.length > 0 && nodeActions.map((act) => (
                    <div key={act.id} className="mt-2 ml-8.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-medium text-[#1C1917]">
                          {act.approver.realName}
                        </span>
                        <span className={`text-[11px] font-medium ${getActionColor(act.action)}`}>
                          {getActionLabel(act.action)}
                        </span>
                        {act.actedAt && (
                          <span className="text-[11px] text-[#78716C]">
                            {formatActionTime(act.actedAt)}
                          </span>
                        )}
                      </div>
                      {act.comment && (
                        <div className="mt-1.5 flex items-start gap-1.5">
                          <MessageSquare className="w-3 h-3 text-[#78716C] shrink-0 mt-0.5" />
                          <p className="text-[12px] text-[#48484A] bg-white/60 rounded-lg px-2.5 py-1.5 border border-[#E7E5E4]">
                            {act.comment}
                          </p>
                        </div>
                      )}
                      {act.signatureUrl && (
                        <div className="mt-1.5">
                          <SignatureImage src={act.signatureUrl} name={act.approver.realName} />
                        </div>
                      )}
                    </div>
                  ))}

                  {nodeActions.length === 0 && nodeStatus === "current" && (
                    <div className="mt-2 ml-8.5">
                      <span className="text-[11px] text-[#1C1917] animate-pulse">审批处理中...</span>
                    </div>
                  )}
                </div>

                {!isLast && (
                  <div className="flex justify-center py-1">
                    <div className={`w-0.5 h-3 rounded-full ${
                      nodeStatus === "done" ? "bg-[#78716C]" : "bg-[#D1D5DB]"
                    }`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ApprovalActionButtonProps {
  instanceId: string | null;
  businessType: string;
  businessId: string;
  flowLevel: string;
  currentStatus: string;
  projectSourceId?: string;
  approvalInstance?: InstanceDetail | null;
  onStatusChange: (newStatus: string, instanceId: string | null) => void;
  onArchiveComplete?: () => void;
  isAdmin?: boolean;
}

export function ApprovalActionButton({
  instanceId,
  businessType,
  businessId,
  flowLevel,
  currentStatus,
  projectSourceId,
  approvalInstance,
  onStatusChange,
  onArchiveComplete,
  isAdmin,
}: ApprovalActionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject">("approve");
  const [comment, setComment] = useState("");
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const [archiveFiles, setArchiveFiles] = useState<string[]>([]);
  const [archiveUploading, setArchiveUploading] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const archiveFileRef = useRef<HTMLInputElement>(null);

  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("银行转账");
  const [bankAccounts, setBankAccounts] = useState<{ id: string; accountName: string; bankName: string; accountNo: string }[]>([]);
  const [bankLoading, setBankLoading] = useState(false);

  const { user: currentUser } = useAuth();

  const currentUserHasActedOnNode = (() => {
    if (!approvalInstance || !currentUser || currentStatus !== "审批中") return false;
    return approvalInstance.actions.some(
      (a: any) => a.nodeId === approvalInstance.currentNode &&
        a.approverId === currentUser.id &&
        (a.action === "approve" || a.action === "reject")
    );
  })();

  useEffect(() => {
    if (showConfirm && commentRef.current) {
      commentRef.current.focus();
    }
  }, [showConfirm]);

  // 判断当前节点是否是归档类型
  const isArchiveNode = (() => {
    if (!approvalInstance || !approvalInstance.flowNodes) return false;
    const currentNode = approvalInstance.flowNodes.find(
      (n: FlowNode) => n.nodeOrder === approvalInstance.currentNode
    );
    return currentNode?.nodeType === "archive";
  })();

  const isPaymentNode = (() => {
    if (!approvalInstance || !approvalInstance.flowNodes) return false;
    const currentNode = approvalInstance.flowNodes.find(
      (n: FlowNode) => n.nodeOrder === approvalInstance.currentNode
    );
    return currentNode?.nodeType === "payment";
  })();

  const isFinanceApprover = (() => {
    if (!approvalInstance || !approvalInstance.flowNodes) return false;
    const financeTypes = ["non_contract_expense", "lending_out", "expense_report", "salary_payment", "borrowing_return_application", "payment_application"];
    if (!financeTypes.includes(businessType)) return false;
    const currentNode = approvalInstance.flowNodes.find(
      (n: FlowNode) => n.nodeOrder === approvalInstance.currentNode
    );
    return currentNode?.approverRole?.split(",").map((r: string) => r.trim()).includes("finance");
  })();

  const fetchBankAccounts = async () => {
    setBankLoading(true);
    try {
      const res = await fetch("/api/bank-accounts?isActive=true&pageSize=200");
      if (res.ok) {
        const json = await res.json();
        setBankAccounts(json.data || []);
      }
    } catch {
      // ignore
    } finally {
      setBankLoading(false);
    }
  };

  const handleSubmitApproval = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/approval-instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType,
          businessId,
          flowLevel,
          projectSourceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "发起审批失败");
        return;
      }

      onStatusChange(data.data.status, data.data.instanceId);
    } catch {
      alert("网络错误");
    } finally {
      setLoading(false);
    }
  };

  const openConfirm = async (action: "approve" | "reject") => {
    if (action === "approve" && isFinanceApprover) {
      setSelectedBankAccountId("");
      setSelectedPaymentMethod("银行转账");
      setComment("");
      await fetchBankAccounts();
      setShowFinanceModal(true);
      return;
    }
    setConfirmAction(action);
    setComment("");
    setShowConfirm(true);
  };

  const handleConfirmAction = async () => {
    if (!instanceId) return;
    if (confirmAction === "reject" && !comment.trim()) {
      alert("请输入驳回原因");
      return;
    }

    setLoading(true);
    setShowConfirm(false);
    try {
      const res = await fetch(`/api/approval-instances/${instanceId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: confirmAction,
          comment: comment.trim() || null,
          projectSourceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "操作失败");
        return;
      }

      onStatusChange(data.data.status, instanceId);
    } catch {
      alert("网络错误");
    } finally {
      setLoading(false);
    }
  };

  const handleFinanceApprove = async () => {
    if (!instanceId) return;
    if (!selectedBankAccountId) {
      alert("请选择银行账户");
      return;
    }
    if (!selectedPaymentMethod) {
      alert("请选择支付方式");
      return;
    }

    setLoading(true);
    setShowFinanceModal(false);
    try {
      const res = await fetch(`/api/approval-instances/${instanceId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          comment: comment.trim() || null,
          projectSourceId,
          bankAccountId: selectedBankAccountId,
          paymentMethod: selectedPaymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "操作失败");
        return;
      }

      onStatusChange(data.data.status, instanceId);
    } catch {
      alert("网络错误");
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (archiveFiles.length === 0) {
      alert("请上传至少1个盖章扫描件");
      return;
    }
    if (!instanceId) return;

    setLoading(true);
    setShowArchive(false);
    try {
      const res = await fetch(`/api/approval-instances/${instanceId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "archive",
          comment: null,
          projectSourceId,
          archivedUrl: JSON.stringify(archiveFiles),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "归档失败");
        return;
      }

      setArchiveFiles([]);
      onStatusChange("已归档", instanceId);
      onArchiveComplete?.();
    } catch {
      alert("网络错误");
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!instanceId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/approval-instances/${instanceId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payment",
          comment: null,
          projectSourceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "支付确认失败");
        return;
      }

      onStatusChange("已支付", instanceId);
      onArchiveComplete?.();
    } catch {
      alert("网络错误");
    } finally {
      setLoading(false);
    }
  };

  if (currentStatus === "草稿" || currentStatus === "已驳回") {
    return (
      <button
        onClick={handleSubmitApproval}
        disabled={loading}
        className="ios-btn !bg-[#1C1917] !text-white text-sm hover:!bg-[#0066DD] disabled:opacity-50"
      >
        {loading ? "提交中..." : "提交审批"}
      </button>
    );
  }

  if (currentStatus === "审批中" && isArchiveNode) {
    return (
      <>
        <input
          ref={archiveFileRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setArchiveUploading(true);
            try {
              const formData = new FormData();
              formData.append("file", file);
              const res = await fetch("/api/upload", { method: "POST", body: formData });
              const json = await res.json();
              if (res.ok) {
                setArchiveFiles(prev => [...prev, json.url]);
              }
            } catch {
              // 上传失败
            } finally {
              setArchiveUploading(false);
              if (archiveFileRef.current) archiveFileRef.current.value = "";
            }
          }}
        />
        <button
          onClick={() => {
            setArchiveFiles([]);
            setShowArchive(true);
          }}
          disabled={loading}
          className="ios-btn !bg-[#8B5CF6] !text-white text-sm hover:!bg-[#7C3AED] disabled:opacity-50 flex items-center gap-1"
        >
          <Archive className="w-3.5 h-3.5" />
          上传扫描件并归档
        </button>

        {showArchive && (
          <div className="fixed inset-0 z-[9998] bg-black/40 flex items-center justify-center" onClick={() => setShowArchive(false)}>
            <div className="bg-white rounded-2xl p-5 w-[440px] max-w-[90vw] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#8B5CF6]/10">
                  <Archive className="w-4 h-4 text-[#8B5CF6]" />
                </div>
                <h3 className="text-[15px] font-bold text-[#1C1917]">合同归档</h3>
              </div>

              <div className="mb-4">
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
                          onClick={() => setArchiveFiles(prev => prev.filter((_, i) => i !== idx))}
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

              <div className="flex justify-end gap-2">
                <button
                  className="ios-btn ios-btn-secondary"
                  onClick={() => setShowArchive(false)}
                >
                  取消
                </button>
                <button
                  className="ios-btn !bg-[#8B5CF6] !text-white text-sm hover:!bg-[#7C3AED] disabled:opacity-50 flex items-center gap-1"
                  disabled={archiveFiles.length === 0 || loading}
                  onClick={handleArchive}
                >
                  <Archive className="w-3.5 h-3.5" />
                  {loading ? "归档中..." : "确认归档"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (currentStatus === "审批中" && isPaymentNode) {
    return (
      <button
        onClick={handlePayment}
        disabled={loading}
        className="ios-btn !bg-[#0D9488] !text-white text-sm hover:!bg-[#0F766E] disabled:opacity-50 flex items-center gap-1"
      >
        <CreditCard className="w-3.5 h-3.5" />
        {loading ? "处理中..." : "确认支付"}
      </button>
    );
  }

  if (currentStatus === "审批中") {
    if (currentUserHasActedOnNode) {
      if (isAdmin && instanceId) {
        return (
          <div className="flex items-center gap-3">
            <p className="text-[13px] text-[#78716C] flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-[#78716C]" />
              已处理
            </p>
            <button
              onClick={async () => {
                if (!confirm("确认强制推进到下一节点？此操作将跳过当前会签等待。")) return;
                setLoading(true);
                try {
                  const res = await fetch("/api/approval-flows/force-advance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ instanceId, projectSourceId }),
                  });
                  const json = await res.json();
                  if (res.ok) {
                    onStatusChange(json.data?.status || "审批中", instanceId);
                  } else {
                    alert(json.error || "强制推进失败");
                  }
                } catch {
                  alert("网络错误");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="ios-btn !bg-[#78716C] !text-white text-sm hover:!bg-[#E08600] disabled:opacity-50 flex items-center gap-1"
            >
              <SkipForward className="w-3.5 h-3.5" />
              强制推进
            </button>
          </div>
        );
      }
      return (
        <p className="text-[13px] text-[#78716C] flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-[#78716C]" />
          已处理
        </p>
      );
    }

    return (
      <>
        <div className="flex gap-2">
          <button
            onClick={() => openConfirm("approve")}
            disabled={loading}
            className="ios-btn !bg-[#2DB84E] !text-white text-sm hover:!bg-[#26A044] disabled:opacity-50 flex items-center gap-1"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {loading ? "处理中..." : "通过"}
          </button>
          <button
            onClick={() => openConfirm("reject")}
            disabled={loading}
            className="ios-btn !bg-[#E0342B] !text-white text-sm hover:!bg-[#C02D25] disabled:opacity-50 flex items-center gap-1"
          >
            <XCircle className="w-3.5 h-3.5" />
            驳回
          </button>
          {isAdmin && instanceId && (
            <button
              onClick={async () => {
                if (!confirm("确认强制推进到下一节点？此操作将跳过当前会签等待。")) return;
                setLoading(true);
                try {
                  const res = await fetch("/api/approval-flows/force-advance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ instanceId, projectSourceId }),
                  });
                  const json = await res.json();
                  if (res.ok) {
                    onStatusChange(json.data?.status || "审批中", instanceId);
                  } else {
                    alert(json.error || "强制推进失败");
                  }
                } catch {
                  alert("网络错误");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="ios-btn !bg-[#78716C] !text-white text-sm hover:!bg-[#E08600] disabled:opacity-50 flex items-center gap-1"
            >
              <SkipForward className="w-3.5 h-3.5" />
              强制推进
            </button>
          )}
        </div>

        {showConfirm && (
          <div className="fixed inset-0 z-[9998] bg-black/40 flex items-center justify-center" onClick={() => setShowConfirm(false)}>
            <div className="bg-white rounded-2xl p-5 w-[400px] max-w-[90vw] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  confirmAction === "approve" ? "bg-[#78716C]/10" : "bg-[#78716C]/10"
                }`}>
                  {confirmAction === "approve" ? (
                    <CheckCircle className="w-4 h-4 text-[#78716C]" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[#78716C]" />
                  )}
                </div>
                <h3 className="text-[15px] font-bold text-[#1C1917]">
                  {confirmAction === "approve" ? "确认通过" : "确认驳回"}
                </h3>
              </div>

              <div className="mb-4">
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  审批意见{confirmAction === "reject" && <span className="text-[#78716C]"> *</span>}
                </label>
                <textarea
                  ref={commentRef}
                  className="ios-input min-h-[80px] resize-none"
                  placeholder={confirmAction === "approve" ? "请输入审批意见（选填）" : "请输入驳回原因（必填）"}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  className="ios-btn ios-btn-secondary"
                  onClick={() => setShowConfirm(false)}
                >
                  取消
                </button>
                <button
                  className={`ios-btn text-white text-sm flex items-center gap-1 ${
                    confirmAction === "approve"
                      ? "!bg-[#2DB84E] hover:!bg-[#26A044]"
                      : "!bg-[#E0342B] hover:!bg-[#C02D25]"
                  }`}
                  onClick={handleConfirmAction}
                >
                  <Send className="w-3.5 h-3.5" />
                  {confirmAction === "approve" ? "确认通过" : "确认驳回"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showFinanceModal && (
          <div className="fixed inset-0 z-[9998] bg-black/40 flex items-center justify-center" onClick={() => setShowFinanceModal(false)}>
            <div className="bg-white rounded-2xl p-5 w-[440px] max-w-[90vw] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#1C1917]/10">
                  <CreditCard className="w-4 h-4 text-[#1C1917]" />
                </div>
                <h3 className="text-[15px] font-bold text-[#1C1917]">财务审批 - 选择支付信息</h3>
              </div>

              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                    支付方式 <span className="text-[#78716C]">*</span>
                  </label>
                  <select
                    className="ios-select"
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  >
                    <option value="银行转账">银行转账</option>
                    <option value="支票">支票</option>
                    <option value="现金">现金</option>
                    <option value="其他">其他</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                    银行账户 <span className="text-[#78716C]">*</span>
                  </label>
                  <select
                    className="ios-select"
                    value={selectedBankAccountId}
                    onChange={(e) => setSelectedBankAccountId(e.target.value)}
                    disabled={bankLoading}
                  >
                    <option value="">{bankLoading ? "加载中..." : "请选择银行账户"}</option>
                    {bankAccounts.map((ba) => (
                      <option key={ba.id} value={ba.id}>
                        {ba.accountName} - {ba.bankName} (****{ba.accountNo.slice(-4)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">审批意见</label>
                  <input
                    type="text"
                    className="ios-input"
                    placeholder="选填"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  className="ios-btn ios-btn-secondary"
                  onClick={() => setShowFinanceModal(false)}
                >
                  取消
                </button>
                <button
                  className="ios-btn !bg-[#2DB84E] !text-white text-sm hover:!bg-[#26A044] disabled:opacity-50 flex items-center gap-1"
                  disabled={loading || !selectedBankAccountId}
                  onClick={handleFinanceApprove}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {loading ? "处理中..." : "确认通过"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
