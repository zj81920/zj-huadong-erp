"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Loader2 } from "lucide-react";

interface AdminStatusOverrideProps {
  businessType: string;
  businessId: string;
  currentStatus: string;
  validStatuses?: string[];
  onStatusChanged?: (newStatus: string) => void;
  size?: "sm" | "md";
}

const STATUS_COLORS: Record<string, string> = {
  "草稿": "ios-badge-gray",
  "审批中": "ios-badge-orange",
  "已批准": "ios-badge-green",
  "已驳回": "ios-badge-red",
  "已转询价": "ios-badge-blue",
  "已采购": "ios-badge-purple",
  "合同归档": "ios-badge-gray",
  "已付款": "ios-badge-green",
  "已发放": "ios-badge-green",
  "未还清": "ios-badge-orange",
  "已还清": "ios-badge-green",
};

const BUSINESS_TYPE_STATUS_MAP: Record<string, string[]> = {
  purchase_request: ["草稿", "审批中", "已批准", "已驳回", "已转询价", "已采购"],
  inquiry: ["草稿", "审批中", "已批准", "已驳回"],
  quotation: ["草稿", "审批中", "已批准", "已驳回"],
  income_contract: ["草稿", "审批中", "已批准", "已驳回", "合同归档"],
  expense_contract: ["草稿", "审批中", "已批准", "已驳回", "合同归档"],
  non_contract_income: ["草稿", "审批中", "已批准", "已驳回"],
  non_contract_expense: ["草稿", "审批中", "已批准", "已驳回"],
  outsourcing: ["草稿", "审批中", "已批准", "已驳回"],
  payment_application: ["草稿", "审批中", "已批准", "已驳回", "已付款"],
  expense_report: ["草稿", "审批中", "已批准", "已驳回"],
  other_borrowing: ["草稿", "审批中", "已批准", "已驳回", "未还清", "已还清"],
  lending_out: ["草稿", "审批中", "已批准", "已驳回", "未还清", "已还清"],
  salary_payment: ["草稿", "审批中", "已批准", "已驳回", "已发放"],
};

export default function AdminStatusOverride({
  businessType,
  businessId,
  currentStatus,
  validStatuses,
  onStatusChanged,
  size = "sm",
}: AdminStatusOverrideProps) {
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    fetch("/api/auth/current-user")
      .then((r) => r.json())
      .then((json) => {
        setIsAdminUser(json.data?.username === "admin");
      })
      .catch(() => {});
  }, []);

  const statuses = validStatuses || BUSINESS_TYPE_STATUS_MAP[businessType] || ["草稿", "审批中", "已批准", "已驳回"];

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newStatus = e.target.value;
      if (newStatus === currentStatus) return;

      setChanging(true);
      try {
        const res = await fetch("/api/admin/set-approval-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessType, businessId, newStatus }),
        });
        if (res.ok) {
          onStatusChanged?.(newStatus);
        } else {
          const json = await res.json();
          alert(json.error || "修改失败");
        }
      } catch {
        alert("网络错误");
      } finally {
        setChanging(false);
      }
    },
    [businessType, businessId, currentStatus, onStatusChanged]
  );

  if (!isAdminUser) {
    const color = STATUS_COLORS[currentStatus] || "ios-badge-gray";
    return (
      <span className={`ios-badge ${color} ${size === "sm" ? "!text-[11px]" : ""}`}>
        {currentStatus}
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <Shield className={`text-[#78716C] ${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={changing}
        className={`ios-select !py-1 !pr-7 !rounded-lg ${
          size === "sm" ? "!text-[11px] !pl-2" : "!text-[12px] !pl-2.5"
        } border-[#78716C]/30 bg-[#78716C]/5`}
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {changing && <Loader2 className="w-3 h-3 text-[#78716C] animate-spin" />}
    </div>
  );
}
