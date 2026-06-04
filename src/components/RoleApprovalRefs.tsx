"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";

interface RoleApprovalRefsProps {
  roleCode: string;
  roleName: string;
}

interface FlowNode {
  id: string;
  businessType: string;
  flowLevel: string;
  nodeOrder: number;
  nodeName: string;
  approverRole: string;
  nodeType: string;
}

export default function RoleApprovalRefs({ roleCode, roleName }: RoleApprovalRefsProps) {
  const [flows, setFlows] = useState<FlowNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/approval-flows")
      .then((r) => r.json())
      .then((json) => {
        setFlows(json.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-8 text-center text-[#78716C]">
        <div className="w-6 h-6 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        加载审批流引用...
      </div>
    );
  }

  // 筛选出引用了该角色的节点
  const matchedNodes = flows.filter((f) => f.approverRole === roleCode);

  if (matchedNodes.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 rounded-full bg-[#FAFAF9] flex items-center justify-center mx-auto mb-3">
          <ShieldCheck className="w-7 h-7 text-[#78716C]" />
        </div>
        <p className="text-sm text-[#78716C]">该角色未被任何审批流程引用</p>
      </div>
    );
  }

  // 按 businessType 分组
  const grouped = matchedNodes.reduce<Record<string, FlowNode[]>>((acc, node) => {
    const key = node.businessType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(node);
    return acc;
  }, {});

  // 业务类型名称映射
  const businessTypeNames: Record<string, string> = {
    quotation: "商务报价",
    supplier: "供应商审批",
    outsourcing: "外包任务",
    purchase_request: "采购需求",
    delivery_receipt: "到货验收",
    income_contract: "收入合同",
    expense_contract: "支出合同",
    non_contract_expense: "其他支付",
    payment_application: "合同支付",
    lending_out: "借出款",
    expense_report: "费用报销",
    salary_payment: "工资发放",
    borrowing_return_application: "借入资金归还",
  };

  return (
    <div>
      <p className="text-sm text-[#78716C] mb-4">
        以下审批流程节点引用了角色「{roleName}」，共 {matchedNodes.length} 处引用
      </p>

      <div className="space-y-4">
        {Object.entries(grouped).map(([businessType, nodes]) => (
          <div
            key={businessType}
            className="rounded-xl border border-[#E7E5E4] overflow-hidden"
          >
            {/* 分组标题 */}
            <div className="px-4 py-2.5 bg-[#FAFAF9] border-b border-[#E7E5E4] flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1C1917]">
                {businessTypeNames[businessType] || businessType}
              </span>
              <Link
                href="/settings/approval-flow"
                className="inline-flex items-center gap-1 text-xs text-[#78716C] hover:text-[#1C1917] transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                前往配置
              </Link>
            </div>

            {/* 节点列表 */}
            <div className="divide-y divide-[#F5F5F4]">
              {nodes.map((node) => (
                <div key={node.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-xs text-[#78716C] w-16">节点 {node.nodeOrder}</span>
                  <span className="text-sm text-[#1C1917]">{node.nodeName}</span>
                  <span className="text-[10px] bg-[#F5F5F4] rounded px-1.5 py-0.5 text-[#78716C] font-medium">
                    {node.nodeType === "approval" ? "审批" : node.nodeType === "cc" ? "抄送" : node.nodeType}
                  </span>
                  <span className="text-xs text-[#78716C] ml-auto">
                    层级: {node.flowLevel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
