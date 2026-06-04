"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

export default function NewChangeOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contractType = searchParams.get("contractType") || "";
  const contractId = searchParams.get("contractId") || "";
  const editId = searchParams.get("edit") || "";
  const [loading, setLoading] = useState(false);
  const [fetchingContract, setFetchingContract] = useState(false);

  const [form, setForm] = useState({
    contractType,
    contractId,
    changeReason: "",
    previousAmount: "",
    newAmount: "",
    newFiles: [] as string[],
    remark: "",
  });

  const [originalContract, setOriginalContract] = useState<any>(null);

  useEffect(() => {
    if (form.contractType && form.contractId) {
      fetchOriginalContract();
    }
  }, [form.contractType, form.contractId]);

  useEffect(() => {
    if (editId) {
      fetchExistingOrder();
    }
  }, [editId]);

  const fetchExistingOrder = async () => {
    try {
      const res = await fetch(`/api/change-orders/${editId}`);
      const json = await res.json();
      if (json.data) {
        const order = json.data;
        setForm({
          contractType: order.contractType,
          contractId: order.contractId,
          changeReason: order.changeReason || "",
          previousAmount: String(order.previousAmount || ""),
          newAmount: String(order.newAmount || ""),
          newFiles: Array.isArray(order.newFiles) ? order.newFiles : [],
          remark: order.remark || "",
        });
        fetchOriginalContract(order.contractType, order.contractId);
      }
    } catch (err) {
      console.error("获取变更单失败:", err);
    }
  };

  const fetchOriginalContract = async (type?: string, cId?: string) => {
    const ct = type || form.contractType;
    const ci = cId || form.contractId;
    if (!ct || !ci) return;

    setFetchingContract(true);
    const apiMap: Record<string, string> = {
      income_contract: `/api/income-contracts/${ci}`,
      expense_contract: `/api/expense-contracts/${ci}`,
      inter_org_contract: `/api/inter-org-contracts/${ci}`,
    };
    const url = apiMap[ct];
    if (!url) { setFetchingContract(false); return; }

    try {
      const res = await fetch(url);
      const json = await res.json();
      const contract = json.data || json;
      setOriginalContract(contract);
      if (!editId) {
        setForm((prev) => ({
          ...prev,
          previousAmount: contract.totalAmount?.toString() || contract.settlementAmount?.toString() || "0",
          newAmount: contract.totalAmount?.toString() || contract.settlementAmount?.toString() || "0",
        }));
      }
    } catch (err) {
      console.error("获取原合同失败:", err);
    } finally {
      setFetchingContract(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.changeReason.trim()) {
      alert("请输入变更原因");
      return;
    }
    if (!form.newAmount || parseFloat(form.newAmount) <= 0) {
      alert("请输入有效的变更后金额");
      return;
    }

    setLoading(true);
    try {
      const isEdit = !!editId;
      const url = isEdit ? `/api/change-orders/${editId}` : "/api/change-orders";
      const method = isEdit ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        contractType: form.contractType,
        contractId: form.contractId,
        changeReason: form.changeReason,
        previousAmount: form.previousAmount,
        newAmount: form.newAmount,
        newFiles: form.newFiles,
        remark: form.remark,
      };

      if (isEdit) {
        body.previousData = originalContract ? {
          contractNo: originalContract.contractNo,
          contractName: originalContract.contractName,
          paymentTerms: originalContract.paymentTerms || "",
          pricingMethod: originalContract.pricingMethod || "",
          taxRate: originalContract.taxRate?.toString() || "",
          contractSummary: originalContract.contractSummary || "",
        } : {};
        body.newData = body.previousData;
      } else {
        body.previousData = originalContract ? {
          contractNo: originalContract.contractNo,
          contractName: originalContract.contractName,
          paymentTerms: originalContract.paymentTerms || "",
          pricingMethod: originalContract.pricingMethod || "",
          taxRate: originalContract.taxRate?.toString() || "",
          contractSummary: originalContract.contractSummary || "",
        } : {};
        body.newData = body.previousData;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const json = await res.json();
        router.push(`/contracts/change-orders/${json.data.id}`);
      } else {
        const json = await res.json();
        alert(json.error || "操作失败");
      }
    } catch (err) {
      alert("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const contractTypeOptions = [
    { value: "", label: "请选择" },
    { value: "income_contract", label: "收入合同" },
    { value: "expense_contract", label: "支出合同" },
    { value: "inter_org_contract", label: "内部结算合同" },
  ];

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "0";
    return num.toLocaleString("zh-CN");
  };

  const diff =
    form.previousAmount && form.newAmount
      ? parseFloat(form.newAmount) - parseFloat(form.previousAmount)
      : 0;

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button
            className="ios-btn ios-btn-ghost"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
          <div>
            <h1>{editId ? "编辑变更单" : "新建变更单"}</h1>
            <p>{editId ? "修改变更单信息" : "创建合同变更单"}</p>
          </div>
        </div>
      </div>

      <div className="bento-card-static max-w-2xl">
        <div className="space-y-4">
          {/* 合同类型和合同编号 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                合同类型 <span className="text-[#78716C]">*</span>
              </label>
              <select
                className="ios-select w-full"
                value={form.contractType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contractType: e.target.value, contractId: "" }))
                }
                disabled={!!editId || !!searchParams.get("contractType")}
              >
                {contractTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                合同编号
              </label>
              <input
                type="text"
                className="ios-input w-full"
                value={form.contractId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contractId: e.target.value }))
                }
                placeholder="输入合同ID或编号"
                disabled={!!editId || !!searchParams.get("contractId")}
              />
            </div>
          </div>

          {/* 原合同信息 */}
          {fetchingContract && (
            <div className="p-3 rounded-xl bg-[#FAFAF9] text-[13px] text-[#78716C]">
              <div className="w-4 h-4 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin inline-block mr-2" />
              加载原合同信息...
            </div>
          )}

          {originalContract && (
            <div className="p-3 rounded-xl bg-[#FAFAF9]">
              <h3 className="text-[13px] font-semibold text-[#1C1917] mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#78716C]" />
                原合同信息
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                <div>
                  <span className="text-[#78716C]">合同编号：</span>
                  <span className="text-[#1C1917] font-medium">
                    {originalContract.contractNo || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[#78716C]">客户/供应商：</span>
                  <span className="text-[#1C1917] font-medium">
                    {originalContract.customer?.name ||
                      originalContract.supplier?.name ||
                      "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[#78716C]">原金额：</span>
                  <span className="text-[#1C1917] font-semibold">
                    {formatAmount(form.previousAmount || "0")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 金额变更 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                原合同金额
              </label>
              <input
                type="text"
                className="ios-input w-full bg-[#FAFAF9]"
                value={formatAmount(form.previousAmount || "0")}
                readOnly
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                变更后金额 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="ios-input w-full"
                value={form.newAmount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, newAmount: e.target.value }))
                }
              />
              {form.previousAmount && form.newAmount && (
                <p
                  className={`text-xs mt-1 ${
                    diff >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  差额：{diff >= 0 ? "+" : ""}
                  {diff.toLocaleString("zh-CN")}
                </p>
              )}
            </div>
          </div>

          {/* 变更原因 */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              变更原因 <span className="text-[#78716C]">*</span>
            </label>
            <textarea
              className="ios-input w-full min-h-[80px] resize-none"
              rows={3}
              value={form.changeReason}
              onChange={(e) =>
                setForm((f) => ({ ...f, changeReason: e.target.value }))
              }
              placeholder="请填写变更原因"
            />
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              备注
            </label>
            <textarea
              className="ios-input w-full min-h-[60px] resize-none"
              rows={2}
              value={form.remark}
              onChange={(e) =>
                setForm((f) => ({ ...f, remark: e.target.value }))
              }
              placeholder="备注信息（可选）"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => router.back()}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "提交中..." : editId ? "保存修改" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
