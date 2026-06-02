"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bug,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Shield,
} from "lucide-react";
import Modal from "@/components/Modal";

interface ApprovalAction {
  id: string;
  nodeId: number;
  nodeName: string;
  approverId: string;
  action: string;
  comment: string | null;
  actedAt: string | null;
  createdAt: string;
  approver: { id: string; realName: string; username: string };
}

interface ApprovalInstance {
  id: string;
  businessType: string;
  businessId: string;
  flowLevel: string;
  currentNode: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  actions: ApprovalAction[];
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  "审批中": { label: "审批中", color: "ios-badge-orange", icon: <Clock className="w-3 h-3" /> },
  "已批准": { label: "已批准", color: "ios-badge-green", icon: <CheckCircle2 className="w-3 h-3" /> },
  "已驳回": { label: "已驳回", color: "ios-badge-red", icon: <XCircle className="w-3 h-3" /> },
};

const BUSINESS_TYPE_MAP: Record<string, string> = {
  quotation: "商务报价",
  outsourcing: "外包任务",
  purchase_request: "采购需求",
  income_contract: "收入合同",
  expense_contract: "支出合同",
  non_contract_income: "非合同收入",
  non_contract_expense: "其他支付",
  payment_application: "合同支付",
  expense_report: "费用报销",
  other_borrowing: "其他借入款",
  lending_out: "借出款",
  salary_payment: "工资发放",
};

export default function ApprovalDebugPage() {
  const [instances, setInstances] = useState<ApprovalInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [modifyModal, setModifyModal] = useState<ApprovalInstance | null>(null);
  const [modifyStatus, setModifyStatus] = useState("");
  const [modifying, setModifying] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<ApprovalInstance | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const checkAdmin = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/current-user");
      if (res.ok) {
        const json = await res.json();
        setIsAdminUser(json.data?.username === "admin");
      }
    } catch {
    } finally {
      setCheckingAdmin(false);
    }
  }, []);

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterType) params.set("businessType", filterType);
      const res = await fetch(`/api/admin/approval-debug?${params}`);
      if (res.ok) {
        const json = await res.json();
        setInstances(json.data || []);
      } else {
        const json = await res.json();
        if (res.status === 403) {
          setIsAdminUser(false);
        }
        setToast({ type: "error", text: json.error || "加载失败" });
      }
    } catch {
      setToast({ type: "error", text: "网络错误" });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType]);

  useEffect(() => {
    checkAdmin();
  }, [checkAdmin]);

  useEffect(() => {
    if (isAdminUser) fetchInstances();
  }, [isAdminUser, fetchInstances]);

  const handleModifyStatus = async () => {
    if (!modifyModal || !modifyStatus) return;
    setModifying(true);
    try {
      const res = await fetch("/api/admin/approval-debug", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId: modifyModal.id,
          status: modifyStatus,
        }),
      });
      if (res.ok) {
        setModifyModal(null);
        setToast({ type: "success", text: `状态已修改为「${modifyStatus}」` });
        fetchInstances();
      } else {
        const json = await res.json();
        setToast({ type: "error", text: json.error || "修改失败" });
      }
    } catch {
      setToast({ type: "error", text: "网络错误" });
    } finally {
      setModifying(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/approval-debug?instanceId=${deleteConfirm.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteConfirm(null);
        setToast({ type: "success", text: "审批实例已删除" });
        fetchInstances();
      } else {
        const json = await res.json();
        setToast({ type: "error", text: json.error || "删除失败" });
      }
    } catch {
      setToast({ type: "error", text: "网络错误" });
    } finally {
      setDeleting(false);
    }
  };

  if (checkingAdmin) {
    return (
      <div className="empty-state min-h-[400px]">
        <div className="w-8 h-8 border-2 border-[#111827] border-t-transparent rounded-full animate-spin" />
        <p>验证权限中...</p>
      </div>
    );
  }

  if (!isAdminUser) {
    return (
      <div className="empty-state min-h-[400px]">
        <div className="w-16 h-16 rounded-full bg-[#6B7280]/10 flex items-center justify-center">
          <Shield className="w-8 h-8 text-[#6B7280]" />
        </div>
        <p className="text-[#6B7280] font-semibold">仅系统管理员可访问此页面</p>
        <p className="text-[13px] text-[#6B7280]">请使用 admin 账号登录</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#6B7280]/10 flex items-center justify-center">
              <Bug className="w-5 h-5 text-[#6B7280]" />
            </div>
            <div>
              <h1>审批调试</h1>
              <p className="text-[#6B7280]">管理员专用 — 直接查看和修改审批实例状态</p>
            </div>
          </div>
          <button
            className="ios-btn ios-btn-secondary gap-1.5"
            onClick={fetchInstances}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="flex items-center gap-3">
            <select
              className="ios-select !w-[140px]"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">全部状态</option>
              <option value="审批中">审批中</option>
              <option value="已批准">已批准</option>
              <option value="已驳回">已驳回</option>
            </select>
            <select
              className="ios-select !w-[160px]"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">全部业务类型</option>
              {Object.entries(BUSINESS_TYPE_MAP).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto text-[13px] text-[#6B7280]">
            共 <span className="font-semibold text-[#111827]">{instances.length}</span> 条记录
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#111827] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : instances.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F9FAFB] flex items-center justify-center">
              <Bug className="w-8 h-8 text-[#6B7280]" />
            </div>
            <p>暂无审批实例</p>
          </div>
        ) : (
          <div className="space-y-2">
            {instances.map((inst) => {
              const statusInfo = STATUS_MAP[inst.status] || STATUS_MAP["审批中"];
              const isExpanded = expandedId === inst.id;

              return (
                <div
                  key={inst.id}
                  className="border border-[#E5E7EB] rounded-2xl overflow-hidden transition-all duration-200"
                >
                  <div
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#FFFFFF] transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : inst.id)}
                  >
                    <button className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#6B7280]" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[14px] text-[#111827]">
                          {BUSINESS_TYPE_MAP[inst.businessType] || inst.businessType}
                        </span>
                        <span className={`ios-badge ${statusInfo.color} gap-1`}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </span>
                        <span className="ios-badge ios-badge-gray">
                          {inst.flowLevel === "common" ? "通用" : inst.flowLevel}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[12px] text-[#6B7280]">
                        <span>业务ID: <span className="font-mono text-[11px]">{inst.businessId.slice(0, 12)}...</span></span>
                        <span>当前节点: {inst.currentNode}</span>
                        <span>创建: {new Date(inst.createdAt).toLocaleString("zh-CN")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        className="ios-btn ios-btn-ghost ios-btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModifyModal(inst);
                          setModifyStatus(inst.status);
                        }}
                      >
                        修改状态
                      </button>
                      <button
                        className="ios-btn ios-btn-ghost ios-btn-sm text-[#6B7280]!"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(inst);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-4 border-t border-[#F3F4F6] bg-[#FFFFFF]">
                      <div className="pt-3">
                        <p className="text-[12px] font-semibold text-[#6B7280] mb-2">审批记录</p>
                        {inst.actions.length === 0 ? (
                          <p className="text-[12px] text-[#6B7280]">暂无操作记录</p>
                        ) : (
                          <div className="space-y-1.5">
                            {inst.actions.map((action) => (
                              <div
                                key={action.id}
                                className="flex items-center gap-3 text-[12px] py-1.5 px-3 bg-white rounded-lg border border-[#F3F4F6]"
                              >
                                <span className="text-[#6B7280] w-[130px] flex-shrink-0">
                                  {new Date(action.actedAt || action.createdAt).toLocaleString("zh-CN")}
                                </span>
                                <span className="font-medium text-[#111827] min-w-[60px]">
                                  {action.approver?.realName || action.approverId}
                                </span>
                                <span className={`ios-badge ${
                                  action.action === "approve" ? "ios-badge-green" :
                                  action.action === "reject" ? "ios-badge-red" :
                                  action.action === "initiate" ? "ios-badge-blue" :
                                  action.action.startsWith("admin_override") ? "ios-badge-orange" :
                                  action.action === "auto_skip" ? "ios-badge-gray" :
                                  "ios-badge-gray"
                                } !text-[10px] !px-1.5 !py-0`}>
                                  {action.action}
                                </span>
                                <span className="text-[#111827]">{action.nodeName}</span>
                                {action.comment && (
                                  <span className="text-[#6B7280] truncate">({action.comment})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
                          <p className="text-[11px] text-[#6B7280]">
                            实例ID: <span className="font-mono">{inst.id}</span>
                          </p>
                          <p className="text-[11px] text-[#6B7280]">
                            业务ID: <span className="font-mono">{inst.businessId}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 修改状态弹窗 */}
      <Modal
        isOpen={!!modifyModal}
        onClose={() => setModifyModal(null)}
        title="管理员强制修改审批状态"
        maxWidth="460px"
      >
        {modifyModal && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[#6B7280]/8 text-[#6B7280] text-[13px] font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              此操作将绕过正常审批流程，强制修改状态
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] text-[13px] space-y-1.5">
              <p><span className="text-[#6B7280]">业务类型：</span>{BUSINESS_TYPE_MAP[modifyModal.businessType] || modifyModal.businessType}</p>
              <p><span className="text-[#6B7280]">当前状态：</span>{modifyModal.status}</p>
              <p><span className="text-[#6B7280]">当前节点：</span>{modifyModal.currentNode}</p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                修改为
              </label>
              <select
                className="ios-select"
                value={modifyStatus}
                onChange={(e) => setModifyStatus(e.target.value)}
              >
                <option value="审批中">审批中</option>
                <option value="已批准">已批准</option>
                <option value="已驳回">已驳回</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#F3F4F6]">
              <button className="ios-btn ios-btn-secondary" onClick={() => setModifyModal(null)}>
                取消
              </button>
              <button
                className="ios-btn ios-btn-primary gap-1.5"
                onClick={handleModifyStatus}
                disabled={modifying || modifyStatus === modifyModal.status}
              >
                {modifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                确认修改
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="确认删除审批实例"
        maxWidth="420px"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#6B7280]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#6B7280]" />
          </div>
          <p className="text-[15px] text-[#111827] mb-1">
            确定要删除此审批实例吗？
          </p>
          <p className="text-[13px] text-[#6B7280] mb-1">
            {BUSINESS_TYPE_MAP[deleteConfirm?.businessType || ""] || deleteConfirm?.businessType}
          </p>
          <p className="text-[12px] text-[#6B7280] mb-4">此操作不可撤销，关联的审批记录将一并删除</p>
          <div className="flex justify-center gap-3">
            <button className="ios-btn ios-btn-secondary" onClick={() => setDeleteConfirm(null)}>
              取消
            </button>
            <button className="ios-btn ios-btn-danger gap-1.5" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              确认删除
            </button>
          </div>
        </div>
      </Modal>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-[14px] font-semibold backdrop-blur-xl transition-all duration-300 ${
            toast.type === "success" ? "bg-[#6B7280]/90 text-white" : "bg-[#6B7280]/90 text-white"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.text}
        </div>
      )}
    </>
  );
}
