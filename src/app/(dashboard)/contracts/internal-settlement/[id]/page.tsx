"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Building2,
  FileCheck,
  Receipt,
  CreditCard,
  User,
  Trash2,
  ChevronRight,
} from "lucide-react";

const statusBadgeMap: Record<string, string> = {
  "草稿": "ios-badge-gray",
  "审批中": "ios-badge-blue",
  "已批准": "ios-badge-green",
  "已驳回": "ios-badge-red",
  "合同归档": "ios-badge-gray",
};

interface Organization {
  id: string;
  name: string;
}

interface RelatedContract {
  id: string;
  contractNo: string;
  totalAmount: string;
  customer?: { id: string; name: string } | null;
  project?: { id: string; name: string; projectSourceId: string } | null;
}

interface ReceiptVoucher {
  id: string;
  voucherNo: string;
  amount: string;
  voucherDate: string;
  [key: string]: unknown;
}

interface Receivable {
  id: string;
  receivableNo: string;
  amount: string;
  status: string;
  dueDate: string;
  receiptVouchers: ReceiptVoucher[];
  [key: string]: unknown;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceCode: string;
  invoiceType: string;
  amount: string;
  invoiceDate: string;
  [key: string]: unknown;
}

interface InterOrgContract {
  id: string;
  contractNo: string;
  contractName: string;
  fromOrgId: string;
  toOrgId: string;
  type: string;
  relatedContractId: string | null;
  mainContractAmount: string | null;
  managementFee: string;
  taxBurden: string;
  otherFee: string;
  otherFeeNote: string | null;
  settlementAmount: string;
  status: string;
  archivedUrl: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  fromOrg: Organization;
  toOrg: Organization;
  relatedContract?: RelatedContract | null;
  receivables?: Receivable[];
  invoices?: Invoice[];
}

export default function InternalSettlementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [contract, setContract] = useState<InterOrgContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchContract = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/inter-org-contracts/${id}`);
        if (res.ok) {
          const json = await res.json();
          setContract(json.data);
        }
      } catch (err) {
        console.error("获取合同详情失败:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchContract();
  }, [id]);

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "¥0.00";
    return `¥${num.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const getStatusBadge = (status: string) => {
    return `ios-badge ${statusBadgeMap[status] || "ios-badge-gray"}`;
  };

  // 提交审批
  const handleSubmitApproval = async () => {
    if (!contract) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/approval-instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: "inter_org_contract",
          businessId: contract.id,
          flowLevel: "common",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        window.location.reload();
      } else {
        alert(json.error || "提交审批失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  // 删除
  const handleDelete = async () => {
    if (!contract) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/inter-org-contracts/${contract.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        window.location.href = "/contracts/internal-settlement";
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setDeleting(false);
    }
  };

  // 解析归档文件
  const parseArchivedFiles = (archivedUrl: string | null): string[] => {
    if (!archivedUrl) return [];
    try {
      const parsed = JSON.parse(archivedUrl);
      return Array.isArray(parsed) ? parsed : [archivedUrl];
    } catch {
      return [archivedUrl];
    }
  };

  if (loading) {
    return (
      <>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <Link href="/contracts/internal-settlement">
              <button className="ios-btn ios-btn-ghost">
                <ArrowLeft className="w-4 h-4" />
                返回列表
              </button>
            </Link>
            <div>
              <h1>合同详情</h1>
              <p>加载中...</p>
            </div>
          </div>
        </div>
        <div className="bento-card-static">
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        </div>
      </>
    );
  }

  if (!contract) {
    return (
      <>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <Link href="/contracts/internal-settlement">
              <button className="ios-btn ios-btn-ghost">
                <ArrowLeft className="w-4 h-4" />
                返回列表
              </button>
            </Link>
            <div>
              <h1>合同详情</h1>
              <p>未找到该合同</p>
            </div>
          </div>
        </div>
        <div className="bento-card-static">
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <FileText className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>未找到合同信息</p>
          </div>
        </div>
      </>
    );
  }

  const archivedFiles = parseArchivedFiles(contract.archivedUrl);
  const receivables = contract.receivables || [];
  const invoices = contract.invoices || [];

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/contracts/internal-settlement">
              <button className="ios-btn ios-btn-ghost">
                <ArrowLeft className="w-4 h-4" />
                返回列表
              </button>
            </Link>
            <div>
              <h1>{contract.contractName}</h1>
              <p>{contract.contractNo}</p>
            </div>
          </div>
          <span className={getStatusBadge(contract.status)}>
            {contract.status}
          </span>
        </div>
      </div>

      {/* 1. 基本信息 */}
      <div className="bento-card-static">
        <h3 className="text-[14px] font-bold text-[#1C1917] mb-4">合同基本信息</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">合同编号</p>
            <p className="text-[14px] font-semibold text-[#1C1917] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#78716C]" />
              {contract.contractNo}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">合同名称</p>
            <p className="text-[14px] font-medium text-[#1C1917]">
              {contract.contractName}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">收款方</p>
            <p className="text-[14px] text-[#1C1917] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#78716C]" />
              {contract.fromOrg.name}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">付款方</p>
            <p className="text-[14px] text-[#1C1917] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#78716C]" />
              {contract.toOrg.name}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">创建时间</p>
            <p className="text-[14px] text-[#1C1917]">{formatDate(contract.createdAt)}</p>
          </div>
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">最后修改</p>
            <p className="text-[14px] text-[#1C1917]">
              {contract.lastModifiedBy && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-[#78716C]" />
                  {contract.lastModifiedBy}
                </span>
              )}
              <span className="text-[12px] text-[#78716C]">{formatDate(contract.updatedAt)}</span>
            </p>
          </div>
        </div>

        {contract.remark && (
          <div className="mt-4 pt-4 border-t border-[#F5F5F4]">
            <p className="text-[12px] text-[#78716C] mb-0.5">备注</p>
            <p className="text-[14px] text-[#1C1917] whitespace-pre-wrap leading-relaxed bg-[#FAFAF9] p-3 rounded-xl">
              {contract.remark}
            </p>
          </div>
        )}
      </div>

      {/* 2. 关联主合同 */}
      {contract.relatedContract && (
        <div className="bento-card-static">
          <h3 className="text-[14px] font-bold text-[#1C1917] mb-4">关联主合同</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <p className="text-[12px] text-[#78716C] mb-0.5">收入合同编号</p>
              <Link
                href={`/contracts/income/${contract.relatedContract.id}`}
                className="text-[14px] font-semibold text-[#1C1917] hover:underline flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-[#78716C]" />
                {contract.relatedContract.contractNo}
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div>
              <p className="text-[12px] text-[#78716C] mb-0.5">客户</p>
              <p className="text-[14px] text-[#1C1917]">
                {contract.relatedContract.customer?.name || "-"}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-[#78716C] mb-0.5">关联项目</p>
              <p className="text-[14px] text-[#1C1917]">
                {contract.relatedContract.project?.name || "-"}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-[#78716C] mb-0.5">合同金额</p>
              <p className="text-[14px] font-bold text-[#1C1917]">
                {formatAmount(contract.relatedContract.totalAmount)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. 费用信息 */}
      <div className="bento-card-static">
        <h3 className="text-[14px] font-bold text-[#1C1917] mb-4">费用信息</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">主合同金额</p>
            <p className="text-[14px] font-semibold text-[#1C1917]">
              {contract.mainContractAmount
                ? formatAmount(contract.mainContractAmount)
                : "-"}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">管理费</p>
            <p className="text-[14px] font-semibold text-[#1C1917]">
              {formatAmount(contract.managementFee)}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">税费承担</p>
            <p className="text-[14px] text-[#1C1917]">
              {formatAmount(contract.taxBurden)}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[#78716C] mb-0.5">其他费用</p>
            <p className="text-[14px] text-[#1C1917]">
              {formatAmount(contract.otherFee)}
              {contract.otherFeeNote && (
                <span className="text-[12px] text-[#78716C] ml-1">
                  （{contract.otherFeeNote}）
                </span>
              )}
            </p>
          </div>
          <div className="col-span-2 pt-3 border-t border-[#F5F5F4]">
            <p className="text-[12px] text-[#78716C] mb-0.5">结算合同额</p>
            <p className="text-[18px] font-bold text-[#1C1917]">
              {formatAmount(contract.settlementAmount)}
            </p>
            <p className="text-[11px] text-[#78716C] mt-0.5">
              = 主合同金额 - 管理费 - 税费承担 - 其他费用
            </p>
          </div>
        </div>
      </div>

      {/* 4. 收款记录 */}
      {receivables.length > 0 && (
        <div className="bento-card-static">
          <h3 className="text-[14px] font-bold text-[#1C1917] mb-4">
            收款记录 ({receivables.length})
          </h3>
          <div className="space-y-4">
            {receivables.map((rec) => (
              <div key={rec.id} className="p-4 rounded-xl bg-[#FAFAF9]">
                <div className="grid grid-cols-3 gap-3 mb-2">
                  <div>
                    <p className="text-[11px] text-[#78716C]">应收编号</p>
                    <p className="text-[13px] font-semibold text-[#1C1917]">
                      {rec.receivableNo || rec.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#78716C]">应收金额</p>
                    <p className="text-[13px] font-semibold text-[#1C1917]">
                      {formatAmount(rec.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#78716C]">到期日</p>
                    <p className="text-[13px] text-[#1C1917]">
                      {formatDate(rec.dueDate)}
                    </p>
                  </div>
                </div>
                {rec.receiptVouchers && rec.receiptVouchers.length > 0 && (
                  <div className="pt-2 border-t border-[#E7E5E4]">
                    <p className="text-[11px] text-[#78716C] mb-2">收款凭证</p>
                    <div className="space-y-1.5">
                      {rec.receiptVouchers.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white"
                        >
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-3.5 h-3.5 text-[#78716C]" />
                            <span className="text-[13px] text-[#1C1917]">
                              {v.voucherNo || v.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[12px] text-[#78716C]">
                              {formatDate(v.voucherDate)}
                            </span>
                            <span className="text-[13px] font-semibold text-[#1C1917]">
                              {formatAmount(v.amount)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. 发票记录 */}
      <div className="bento-card-static">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-bold text-[#1C1917]">
            发票记录 ({invoices.length})
          </h3>
          <Link href={`/finance/invoices/new?sourceType=inter_org_contract&sourceId=${contract.id}`}>
            <button className="ios-btn ios-btn-primary ios-btn-sm">
              <Receipt className="w-3.5 h-3.5" />
              开票登记
            </button>
          </Link>
        </div>
        {invoices.length === 0 ? (
          <p className="text-[13px] text-[#78716C]">暂无发票记录</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#FAFAF9]"
              >
                <div className="flex items-center gap-3">
                  <Receipt className="w-4 h-4 text-[#78716C]" />
                  <div>
                    <p className="text-[13px] font-semibold text-[#1C1917]">
                      {inv.invoiceNo || inv.invoiceCode || "发票"}
                    </p>
                    <p className="text-[11px] text-[#78716C]">
                      {inv.invoiceType} · {formatDate(inv.invoiceDate)}
                    </p>
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-[#1C1917]">
                  {formatAmount(inv.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. 归档文件 */}
      {archivedFiles.length > 0 && (
        <div className="bento-card-static">
          <h3 className="text-[14px] font-bold text-[#1C1917] mb-4">归档文件</h3>
          <div className="flex flex-wrap gap-2">
            {archivedFiles.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[12px] text-[#1C1917] hover:underline"
              >
                <FileCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
                {url.split("/").pop() || `文件${idx + 1}`}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 7. 操作按钮 */}
      <div className="bento-card-static">
        <div className="flex items-center justify-end gap-3">
          {/* 开票登记 */}
          <Link href={`/finance/invoices/new?sourceType=inter_org_contract&sourceId=${contract.id}`}>
            <button className="ios-btn ios-btn-secondary">
              <Receipt className="w-4 h-4" />
              开票登记
            </button>
          </Link>

          {/* 编辑：草稿/已驳回 */}
          {(contract.status === "草稿" || contract.status === "已驳回") && (
            <Link href={`/contracts/internal-settlement/new?edit=${contract.id}`}>
              <button className="ios-btn ios-btn-secondary">
                编辑合同
              </button>
            </Link>
          )}

          {/* 删除：草稿 */}
          {contract.status === "草稿" && (
            <button
              className="ios-btn ios-btn-secondary text-[#78716C]!"
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          )}

          {/* 提交审批：草稿 */}
          {contract.status === "草稿" && (
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleSubmitApproval}
              disabled={submitting}
            >
              {submitting ? "提交中..." : "提交审批"}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* 发起变更：已批准/已归档 */}
          {(contract.status === "已批准" || contract.status === "合同归档") && (
            <Link href={`/contracts/change-orders/new?contractType=inter_org_contract&contractId=${contract.id}`}>
              <button className="ios-btn ios-btn-secondary">
                发起变更
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[400px] mx-4">
            <h3 className="text-[16px] font-bold text-[#1C1917] mb-2">确认删除</h3>
            <p className="text-[13px] text-[#78716C] mb-6">
              确定要删除合同 &quot;{contract.contractNo}&quot; 吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="ios-btn ios-btn-secondary"
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
              >
                取消
              </button>
              <button
                className="ios-btn ios-btn-primary"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
