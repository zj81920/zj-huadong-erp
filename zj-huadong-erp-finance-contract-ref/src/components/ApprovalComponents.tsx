"use client";

import React, { useState } from "react";
import { CheckCircle, XCircle, Clock, FileText, ChevronDown, ChevronUp } from "lucide-react";

interface FlowNode {
  nodeOrder: number;
  nodeName: string;
  approverRole: string;
}

interface ActionRecord {
  id: string;
  nodeId: number;
  nodeName: string;
  action: string;
  comment: string | null;
  actedAt: string | null;
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
      {c.label}
    </span>
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
            <div key={i} className="h-8 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!instance) return null;

  const { flowNodes, actions, currentNode, status } = instance;

  const getActionForNode = (nodeOrder: number) => {
    return actions.filter((a) => a.nodeId === nodeOrder);
  };

  const getNodeStatus = (nodeOrder: number): "done" | "current" | "pending" => {
    if (status === "已驳回") {
      const rejectAction = actions.find((a) => a.action === "reject");
      if (rejectAction && nodeOrder <= rejectAction.nodeId) {
        return nodeOrder === rejectAction.nodeId ? "current" : "done";
      }
      if (nodeOrder < currentNode) return "done";
      if (nodeOrder === currentNode) return "current";
      return "pending";
    }
    if (nodeOrder < currentNode) return "done";
    if (nodeOrder === currentNode && status === "审批中") return "current";
    if (status === "已批准" || status === "合同归档") return "done";
    return "pending";
  };

  return (
    <div className="bento-card-static p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-[#1D1D1F] w-full cursor-pointer"
      >
        <FileText className="w-4 h-4 text-[#007AFF]" />
        审批流程
        <ApprovalStatusBadge status={status} />
        <span className="ml-auto">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-0">
          {flowNodes.map((node, idx) => {
            const nodeStatus = getNodeStatus(node.nodeOrder);
            const nodeActions = getActionForNode(node.nodeOrder);

            return (
              <div key={node.nodeOrder} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                      nodeStatus === "done"
                        ? "bg-green-500 text-white"
                        : nodeStatus === "current"
                        ? "bg-blue-500 text-white ring-2 ring-blue-200"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {nodeStatus === "done" ? "✓" : idx + 1}
                  </div>
                  {idx < flowNodes.length - 1 && (
                    <div
                      className={`w-0.5 h-8 ${
                        nodeStatus === "done" ? "bg-green-300" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
                <div className="pb-4 flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#1D1D1F]">
                    {node.nodeName}
                  </div>
                  {nodeActions.length > 0 ? (
                    nodeActions.map((act) => (
                      <div key={act.id} className="mt-1 text-xs text-[#86868B]">
                        <span className="font-medium">{act.approver.realName}</span>
                        <span className="mx-1">
                          {act.action === "initiate" && "发起"}
                          {act.action === "approve" && "通过"}
                          {act.action === "reject" && "驳回"}
                          {act.action === "auto_skip" && "自动跳过"}
                        </span>
                        {act.actedAt && (
                          <span>{new Date(act.actedAt).toLocaleString("zh-CN")}</span>
                        )}
                        {act.comment && (
                          <span className="ml-1">({act.comment})</span>
                        )}
                      </div>
                    ))
                  ) : (
                    nodeStatus === "pending" && (
                      <div className="mt-1 text-xs text-gray-300">等待审批...</div>
                    )
                  )}
                </div>
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
  onStatusChange: (newStatus: string, instanceId: string | null) => void;
}

export function ApprovalActionButton({
  instanceId,
  businessType,
  businessId,
  flowLevel,
  currentStatus,
  projectSourceId,
  onStatusChange,
}: ApprovalActionButtonProps) {
  const [loading, setLoading] = useState(false);

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

  const handleAction = async (action: "approve" | "reject") => {
    if (!instanceId) return;

    const comment = action === "reject"
      ? prompt("请输入驳回原因：")
      : null;

    if (action === "reject" && comment === null) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/approval-instances/${instanceId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          comment,
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

  if (currentStatus === "草稿") {
    return (
      <button
        onClick={handleSubmitApproval}
        disabled={loading}
        className="ios-btn !bg-[#007AFF] !text-white text-sm hover:!bg-[#0066DD] disabled:opacity-50"
      >
        {loading ? "提交中..." : "提交审批"}
      </button>
    );
  }

  if (currentStatus === "审批中") {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => handleAction("approve")}
          disabled={loading}
          className="ios-btn !bg-[#34C759] !text-white text-sm hover:!bg-[#2DB84E] disabled:opacity-50 flex items-center gap-1"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          {loading ? "处理中..." : "通过"}
        </button>
        <button
          onClick={() => handleAction("reject")}
          disabled={loading}
          className="ios-btn !bg-[#FF3B30] !text-white text-sm hover:!bg-[#E0342B] disabled:opacity-50 flex items-center gap-1"
        >
          <XCircle className="w-3.5 h-3.5" />
          驳回
        </button>
      </div>
    );
  }

  return null;
}
