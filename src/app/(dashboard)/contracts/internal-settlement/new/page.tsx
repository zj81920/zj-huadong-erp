"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, FileText, Building2, Search, X } from "lucide-react";
import Modal from "@/components/Modal";

interface Organization {
  id: string;
  name: string;
}

interface IncomeContract {
  id: string;
  contractNo: string;
  projectSourceId: string | null;
  interOrgContractId: string | null;
  totalAmount: string;
  status: string;
  signedDate?: string | null;
  createdAt: string;
  customer?: { id: string; name: string };
  project?: { id: string; name: string; projectSourceId: string } | null;
}

interface FormData {
  contractNo: string;
  contractName: string;
  fromOrgId: string;
  toOrgId: string;
  relatedContractId: string;
  mainContractAmount: string;
  managementFee: string;
  taxBurden: string;
  otherFee: string;
  otherFeeNote: string;
  settlementAmount: string;
  remark: string;
}

const emptyForm: FormData = {
  contractNo: "",
  contractName: "",
  fromOrgId: "",
  toOrgId: "",
  relatedContractId: "",
  mainContractAmount: "",
  managementFee: "",
  taxBurden: "0",
  otherFee: "0",
  otherFeeNote: "",
  settlementAmount: "",
  remark: "",
};

export default function NewInternalSettlementPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(emptyForm);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [incomeContracts, setIncomeContracts] = useState<IncomeContract[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [showContractPicker, setShowContractPicker] = useState(false);
  const [contractSearch, setContractSearch] = useState("");

  // 当前选中的合同信息
  const selectedContract = incomeContracts.find((c) => c.id === form.relatedContractId);

  // 弹窗内筛选后的合同列表
  const filteredContracts = incomeContracts.filter((c) => {
    if (!contractSearch.trim()) return true;
    const kw = contractSearch.toLowerCase();
    return (
      c.contractNo.toLowerCase().includes(kw) ||
      c.customer?.name?.toLowerCase().includes(kw) ||
      c.project?.name?.toLowerCase().includes(kw)
    );
  });

  // 获取组织列表
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await fetch("/api/organizations?pageSize=200");
        if (res.ok) {
          const json = await res.json();
          setOrganizations(json.data || []);
        }
      } catch {
        setOrganizations([]);
      }
    };
    fetchOrgs();
  }, []);

  // 获取收入合同列表（仅显示有 projectSourceId 的）
  useEffect(() => {
    const fetchIncomeContracts = async () => {
      try {
        const res = await fetch("/api/income-contracts?pageSize=500");
        if (res.ok) {
          const json = await res.json();
          const all = json.data || [];
          // 仅保留有 projectSourceId 且未被其他结算合同关联的收入合同
          setIncomeContracts(all.filter((c: IncomeContract) =>
            c.projectSourceId && !c.interOrgContractId
          ));
        }
      } catch {
        setIncomeContracts([]);
      }
    };
    fetchIncomeContracts();
  }, []);

  // relatedContractId 变化时获取收入合同详情，自动填入 mainContractAmount
  const handleRelatedContractChange = async (contractId: string) => {
    updateForm("relatedContractId", contractId);
    if (!contractId) {
      updateForm("mainContractAmount", "");
      return;
    }
    try {
      const res = await fetch(`/api/income-contracts/${contractId}`);
      if (res.ok) {
        const json = await res.json();
        const income = json.data;
        if (income) {
          updateForm("mainContractAmount", String(income.totalAmount || ""));
        }
      }
    } catch {
      // 获取失败，静默处理
    }
  };

  // 自动计算结算合同额
  const calcSettlementAmount = (
    main: string,
    mgmt: string,
    tax: string,
    other: string
  ) => {
    const mainNum = parseFloat(main) || 0;
    const mgmtNum = parseFloat(mgmt) || 0;
    const taxNum = parseFloat(tax) || 0;
    const otherNum = parseFloat(other) || 0;
    const result = (mainNum - mgmtNum - taxNum - otherNum).toFixed(2);
    return result;
  };

  const updateForm = (field: keyof FormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // 费用字段变化时自动重算结算额
      if (
        field === "mainContractAmount" ||
        field === "managementFee" ||
        field === "taxBurden" ||
        field === "otherFee"
      ) {
        next.settlementAmount = calcSettlementAmount(
          field === "mainContractAmount" ? value : next.mainContractAmount,
          field === "managementFee" ? value : next.managementFee,
          field === "taxBurden" ? value : next.taxBurden,
          field === "otherFee" ? value : next.otherFee
        );
      }
      return next;
    });
    if (formError) setFormError("");
  };

  const handleSubmit = async () => {
    if (!form.contractNo.trim()) {
      setFormError("合同编号不能为空");
      return;
    }
    if (!form.contractName.trim()) {
      setFormError("合同名称不能为空");
      return;
    }
    if (!form.fromOrgId) {
      setFormError("请选择收款方");
      return;
    }
    if (!form.toOrgId) {
      setFormError("请选择付款方");
      return;
    }
    if (!form.managementFee || parseFloat(form.managementFee) < 0) {
      setFormError("管理费不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        contractNo: form.contractNo.trim(),
        contractName: form.contractName.trim(),
        fromOrgId: form.fromOrgId,
        toOrgId: form.toOrgId,
        type: "MANAGEMENT_FEE",
        relatedContractId: form.relatedContractId || null,
        mainContractAmount: form.mainContractAmount || null,
        managementFee: form.managementFee || "0",
        taxBurden: form.taxBurden || "0",
        otherFee: form.otherFee || "0",
        otherFeeNote: form.otherFeeNote || null,
        settlementAmount: form.settlementAmount || "0",
        remark: form.remark || null,
      };

      const res = await fetch("/api/inter-org-contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        router.push("/contracts/internal-settlement");
      } else {
        setFormError(json.error || "创建失败");
      }
    } catch {
      setFormError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  const otherFeeNum = parseFloat(form.otherFee) || 0;

  const formatAmount = (val: string | number) => {
    const n = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(n)) return "-";
    return `¥${n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (d: string) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("zh-CN");
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      "已批准": "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800",
      "已归档": "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800",
      "草稿": "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600",
      "已驳回": "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-800",
      "审批中": "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-100 text-yellow-800",
    };
    return map[status] || "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600";
  };

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
              <h1>新增内部结算合同</h1>
              <p>填写合同信息，创建管理费结算合同</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="space-y-5">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {formError}
            </div>
          )}

          {/* 1. 基本信息 */}
          <div>
            <h3 className="text-[14px] font-bold text-[#1C1917] mb-3">基本信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  合同编号 <span className="text-[#78716C]">*</span>
                </label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="请输入合同编号"
                  value={form.contractNo}
                  onChange={(e) => updateForm("contractNo", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  合同名称 <span className="text-[#78716C]">*</span>
                </label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="请输入合同名称"
                  value={form.contractName}
                  onChange={(e) => updateForm("contractName", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  收款方 <span className="text-[#78716C]">*</span>
                </label>
                <select
                  className="ios-select"
                  value={form.fromOrgId}
                  onChange={(e) => updateForm("fromOrgId", e.target.value)}
                >
                  <option value="">请选择收款方</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  付款方 <span className="text-[#78716C]">*</span>
                </label>
                <select
                  className="ios-select"
                  value={form.toOrgId}
                  onChange={(e) => updateForm("toOrgId", e.target.value)}
                >
                  <option value="">请选择付款方</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. 关联主合同 */}
          <div>
            <h3 className="text-[14px] font-bold text-[#1C1917] mb-3">关联主合同</h3>

            {selectedContract ? (
              // 已选择：展示合同信息卡片
              <div className="flex items-center justify-between p-3 rounded-lg border border-[#E7E5E4] bg-[#FAFAF9]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1C1917]/8 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-[#1C1917]" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#1C1917]">
                      {selectedContract.contractNo}
                      {selectedContract.customer ? ` - ${selectedContract.customer.name}` : ""}
                    </div>
                    <div className="text-[12px] text-[#78716C] mt-0.5">
                      {selectedContract.project?.name || "无关联项目"}
                      {" · "}
                      {formatAmount(selectedContract.totalAmount)}
                      {" · "}
                      {selectedContract.status}
                    </div>
                  </div>
                </div>
                <button
                  className="text-[12px] text-[#78716C] hover:text-red-600 transition-colors flex items-center gap-1"
                  onClick={() => handleRelatedContractChange("")}
                >
                  <X className="w-3 h-3" />
                  取消
                </button>
              </div>
            ) : (
              // 未选择：显示选择按钮
              <button
                className="ios-btn ios-btn-secondary flex items-center gap-2"
                onClick={() => {
                  setContractSearch("");
                  setShowContractPicker(true);
                }}
              >
                <Search className="w-4 h-4" />
                选择关联合同
              </button>
            )}

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  主合同金额
                </label>
                <input
                  type="text"
                  className="ios-input bg-[#FAFAF9]"
                  value={
                    form.mainContractAmount
                      ? `¥${parseFloat(form.mainContractAmount).toLocaleString("zh-CN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : ""
                  }
                  placeholder="选择收入合同后自动带出"
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* 合同选择弹窗 */}
          <Modal
            isOpen={showContractPicker}
            onClose={() => setShowContractPicker(false)}
            title="选择关联合同"
            maxWidth="800px"
          >
            <div className="space-y-4">
              {/* 搜索框 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="text"
                  className="ios-input pl-9"
                  placeholder="搜索合同编号、客户名称、项目名称..."
                  value={contractSearch}
                  onChange={(e) => setContractSearch(e.target.value)}
                  autoFocus
                />
              </div>

              {/* 合同列表 */}
              <div className="border border-[#E7E5E4] rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
                <table className="ios-table">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr>
                      <th>合同编号</th>
                      <th>客户</th>
                      <th>项目</th>
                      <th>金额</th>
                      <th>状态</th>
                      <th>签约日期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContracts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-[#78716C] py-8 text-[13px]">
                          {contractSearch ? "无匹配的合同" : "暂无可关联的收入合同"}
                        </td>
                      </tr>
                    ) : (
                      filteredContracts.map((c) => {
                        const isSelected = form.relatedContractId === c.id;
                        return (
                          <tr
                            key={c.id}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-[#1C1917]/8"
                                : "hover:bg-[#F5F5F4]"
                            }`}
                            onClick={() => {
                              handleRelatedContractChange(c.id);
                              setShowContractPicker(false);
                            }}
                          >
                            <td>
                              <span className="font-semibold text-[13px]">{c.contractNo}</span>
                            </td>
                            <td>
                              <div className="flex items-center gap-1.5 text-[13px]">
                                <Building2 className="w-3 h-3 text-[#78716C]" />
                                {c.customer?.name || "-"}
                              </div>
                            </td>
                            <td className="text-[13px] text-[#78716C]">
                              {c.project?.name || "-"}
                            </td>
                            <td className="font-semibold text-[13px]">
                              {formatAmount(c.totalAmount)}
                            </td>
                            <td>
                              <span className={getStatusBadge(c.status)}>
                                {c.status}
                              </span>
                            </td>
                            <td className="text-[12px] text-[#78716C]">
                              {formatDate(c.signedDate || c.createdAt)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-[12px] text-[#78716C] text-right">
                共 {filteredContracts.length} 个合同
              </div>
            </div>
          </Modal>

          {/* 3. 费用信息 */}
          <div>
            <h3 className="text-[14px] font-bold text-[#1C1917] mb-3">费用信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  管理费 <span className="text-[#78716C]">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="ios-input"
                  placeholder="请输入管理费金额"
                  value={form.managementFee}
                  onChange={(e) => updateForm("managementFee", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  税费承担
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="ios-input"
                  placeholder="请输入税费承担金额，默认0"
                  value={form.taxBurden}
                  onChange={(e) => updateForm("taxBurden", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  其他费用
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="ios-input"
                  placeholder="请输入其他费用，默认0"
                  value={form.otherFee}
                  onChange={(e) => updateForm("otherFee", e.target.value)}
                />
              </div>

              {otherFeeNum > 0 && (
                <div>
                  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                    其他费用说明 <span className="text-[#78716C]">*</span>
                  </label>
                  <input
                    type="text"
                    className="ios-input"
                    placeholder="请说明其他费用用途"
                    value={form.otherFeeNote}
                    onChange={(e) => updateForm("otherFeeNote", e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  结算合同额
                </label>
                <input
                  type="text"
                  className="ios-input bg-[#FAFAF9] font-bold"
                  value={
                    form.settlementAmount
                      ? `¥${parseFloat(form.settlementAmount).toLocaleString("zh-CN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : "¥0.00"
                  }
                  readOnly
                />
                <p className="text-[11px] text-[#78716C] mt-1">
                  = 主合同金额 - 管理费 - 税费承担 - 其他费用
                </p>
              </div>
            </div>
          </div>

          {/* 4. 备注 */}
          <div>
            <h3 className="text-[14px] font-bold text-[#1C1917] mb-3">备注</h3>
            <textarea
              className="ios-input min-h-[80px] resize-none"
              placeholder="请输入备注信息（可选）"
              value={form.remark}
              onChange={(e) => updateForm("remark", e.target.value)}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <Link href="/contracts/internal-settlement">
              <button className="ios-btn ios-btn-secondary">取消</button>
            </Link>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleSubmit}
              disabled={saving}
            >
              <Save className="w-4 h-4" />
              {saving ? "保存中..." : "创建合同"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
