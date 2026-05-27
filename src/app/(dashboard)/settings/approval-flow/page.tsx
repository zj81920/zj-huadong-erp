"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings2,
  Plus,
  X,
  ChevronDown,
  Save,
  RotateCcw,
  Copy,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Modal from "@/components/Modal";

const BUSINESS_MODULES = [
  { type: "quotation", name: "商务报价", hasFlowLevel: false },
  { type: "outsourcing", name: "外包任务", hasFlowLevel: false },
  { type: "purchase_request", name: "采购需求", hasFlowLevel: false },
  { type: "income_contract", name: "收入合同", hasFlowLevel: true },
  { type: "expense_contract", name: "支出合同", hasFlowLevel: true },
  { type: "non_contract_income", name: "非合同收入", hasFlowLevel: true },
  { type: "non_contract_expense", name: "非合同支出", hasFlowLevel: true },
  { type: "payment_application", name: "付款申请", hasFlowLevel: false },
  { type: "expense_report", name: "费用报销", hasFlowLevel: true },
  { type: "other_borrowing", name: "其他借入款", hasFlowLevel: false },
  { type: "lending_out", name: "借出款", hasFlowLevel: false },
  { type: "salary_payment", name: "工资发放", hasFlowLevel: false },
];

const APPROVER_ROLES_FALLBACK = [
  { value: "initiator", label: "经办人" },
  { value: "dept_head", label: "部门负责人" },
  { value: "project_manager", label: "项目经理" },
  { value: "pmo", label: "项目管理部" },
  { value: "admin", label: "行政" },
  { value: "procurement", label: "采购部" },
  { value: "production", label: "设计负责人/生产经理" },
  { value: "finance", label: "财务" },
  { value: "vice_gm", label: "副总经理" },
  { value: "gm", label: "总经理" },
  { value: "chairman", label: "董事长" },
  { value: "cashier", label: "出纳" },
];

const DEFAULT_FLOWS: Record<
  string,
  Record<string, { nodeOrder: number; nodeName: string; approverRole: string }[]>
> = {
  quotation: {
    common: [
      { nodeOrder: 1, nodeName: "项目经理", approverRole: "project_manager" },
      { nodeOrder: 2, nodeName: "部门负责人", approverRole: "dept_head" },
      { nodeOrder: 3, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 4, nodeName: "总经理", approverRole: "gm" },
    ],
  },
  outsourcing: {
    common: [
      { nodeOrder: 1, nodeName: "设计负责人/生产经理", approverRole: "production" },
      { nodeOrder: 2, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 3, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 4, nodeName: "董事长", approverRole: "chairman" },
    ],
  },
  purchase_request: {
    common: [
      { nodeOrder: 1, nodeName: "项目经理", approverRole: "project_manager" },
      { nodeOrder: 2, nodeName: "采购部", approverRole: "procurement" },
      { nodeOrder: 3, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 4, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 5, nodeName: "董事长", approverRole: "chairman" },
    ],
  },
  income_contract: {
    project: [
      { nodeOrder: 1, nodeName: "行政", approverRole: "admin" },
      { nodeOrder: 2, nodeName: "项目管理部", approverRole: "pmo" },
      { nodeOrder: 3, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 4, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 5, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 6, nodeName: "董事长", approverRole: "chairman" },
    ],
    company: [
      { nodeOrder: 1, nodeName: "行政", approverRole: "admin" },
      { nodeOrder: 2, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 3, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 4, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 5, nodeName: "董事长", approverRole: "chairman" },
    ],
  },
  expense_contract: {
    project: [
      { nodeOrder: 1, nodeName: "行政", approverRole: "admin" },
      { nodeOrder: 2, nodeName: "项目管理部", approverRole: "pmo" },
      { nodeOrder: 3, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 4, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 5, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 6, nodeName: "董事长", approverRole: "chairman" },
    ],
    company: [
      { nodeOrder: 1, nodeName: "行政", approverRole: "admin" },
      { nodeOrder: 2, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 3, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 4, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 5, nodeName: "董事长", approverRole: "chairman" },
    ],
  },
  non_contract_income: {
    project: [
      { nodeOrder: 1, nodeName: "经办人", approverRole: "initiator" },
      { nodeOrder: 2, nodeName: "部门负责人", approverRole: "dept_head" },
      { nodeOrder: 3, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 4, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 5, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 6, nodeName: "董事长", approverRole: "chairman" },
    ],
    company: [
      { nodeOrder: 1, nodeName: "经办人", approverRole: "initiator" },
      { nodeOrder: 2, nodeName: "部门负责人", approverRole: "dept_head" },
      { nodeOrder: 3, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 4, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 5, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 6, nodeName: "董事长", approverRole: "chairman" },
    ],
  },
  non_contract_expense: {
    project: [
      { nodeOrder: 1, nodeName: "经办人", approverRole: "initiator" },
      { nodeOrder: 2, nodeName: "部门负责人", approverRole: "dept_head" },
      { nodeOrder: 3, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 4, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 5, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 6, nodeName: "董事长", approverRole: "chairman" },
    ],
    company: [
      { nodeOrder: 1, nodeName: "经办人", approverRole: "initiator" },
      { nodeOrder: 2, nodeName: "部门负责人", approverRole: "dept_head" },
      { nodeOrder: 3, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 4, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 5, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 6, nodeName: "董事长", approverRole: "chairman" },
    ],
  },
  payment_application: {
    common: [
      { nodeOrder: 1, nodeName: "经办人", approverRole: "initiator" },
      { nodeOrder: 2, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 3, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 4, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 5, nodeName: "董事长", approverRole: "chairman" },
      { nodeOrder: 6, nodeName: "出纳", approverRole: "cashier" },
    ],
  },
  expense_report: {
    project: [
      { nodeOrder: 1, nodeName: "经办人", approverRole: "initiator" },
      { nodeOrder: 2, nodeName: "部门负责人", approverRole: "dept_head" },
      { nodeOrder: 3, nodeName: "项目经理", approverRole: "project_manager" },
      { nodeOrder: 4, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 5, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 6, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 7, nodeName: "董事长", approverRole: "chairman" },
      { nodeOrder: 8, nodeName: "出纳", approverRole: "cashier" },
    ],
    company: [
      { nodeOrder: 1, nodeName: "经办人", approverRole: "initiator" },
      { nodeOrder: 2, nodeName: "部门负责人", approverRole: "dept_head" },
      { nodeOrder: 3, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 4, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 5, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 6, nodeName: "董事长", approverRole: "chairman" },
      { nodeOrder: 7, nodeName: "出纳", approverRole: "cashier" },
    ],
  },
  other_borrowing: {
    common: [
      { nodeOrder: 1, nodeName: "经办人", approverRole: "initiator" },
      { nodeOrder: 2, nodeName: "部门负责人", approverRole: "dept_head" },
      { nodeOrder: 3, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 4, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 5, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 6, nodeName: "董事长", approverRole: "chairman" },
      { nodeOrder: 7, nodeName: "出纳", approverRole: "cashier" },
    ],
  },
  lending_out: {
    common: [
      { nodeOrder: 1, nodeName: "经办人", approverRole: "initiator" },
      { nodeOrder: 2, nodeName: "部门负责人", approverRole: "dept_head" },
      { nodeOrder: 3, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 4, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 5, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 6, nodeName: "董事长", approverRole: "chairman" },
      { nodeOrder: 7, nodeName: "出纳", approverRole: "cashier" },
    ],
  },
  salary_payment: {
    common: [
      { nodeOrder: 1, nodeName: "经办人", approverRole: "initiator" },
      { nodeOrder: 2, nodeName: "部门负责人", approverRole: "dept_head" },
      { nodeOrder: 3, nodeName: "财务", approverRole: "finance" },
      { nodeOrder: 4, nodeName: "副总经理", approverRole: "vice_gm" },
      { nodeOrder: 5, nodeName: "总经理", approverRole: "gm" },
      { nodeOrder: 6, nodeName: "董事长", approverRole: "chairman" },
      { nodeOrder: 7, nodeName: "出纳", approverRole: "cashier" },
    ],
  },
};

const CIRCLE_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];

interface FlowNode {
  nodeOrder: number;
  nodeName: string;
  approverRole: string;
}

type FlowLevel = "common" | "project" | "company";

interface SavedFlows {
  [key: string]: {
    [level: string]: FlowNode[];
  };
}

function getFlowLevels(moduleType: string): FlowLevel[] {
  const mod = BUSINESS_MODULES.find((m) => m.type === moduleType);
  return mod?.hasFlowLevel ? ["project", "company"] : ["common"];
}

function getDefaultNodes(moduleType: string, level: string): FlowNode[] {
  const flows = DEFAULT_FLOWS[moduleType];
  if (!flows) return [];
  const nodes = flows[level] || flows["common"] || [];
  return nodes.map((n) => ({ ...n }));
}

export default function ApprovalFlowPage() {
  const [selectedModule, setSelectedModule] = useState(BUSINESS_MODULES[0].type);
  const [flowLevel, setFlowLevel] = useState<FlowLevel>("common");
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [savedFlows, setSavedFlows] = useState<SavedFlows>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchTargets, setBatchTargets] = useState<Record<string, string[]>>({});
  const [batchApplying, setBatchApplying] = useState(false);
  const [approverRoles, setApproverRoles] = useState(APPROVER_ROLES_FALLBACK);

  const currentModule = BUSINESS_MODULES.find((m) => m.type === selectedModule)!;
  const availableLevels = getFlowLevels(selectedModule);

  const loadNodes = useCallback(
    (moduleType: string, level: string) => {
      const saved = savedFlows[moduleType]?.[level];
      if (saved) {
        setNodes(saved.map((n) => ({ ...n })));
      } else {
        setNodes(getDefaultNodes(moduleType, level));
      }
    },
    [savedFlows],
  );

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const res = await fetch("/api/roles");
        if (res.ok) {
          const { data } = await res.json();
          if (data) {
            setApproverRoles(data.map((r: { code: string; name: string; isProjectRole: boolean }) => ({
              value: r.code,
              label: r.name,
              isProjectRole: r.isProjectRole,
            })));
          }
        }
      } catch {}
    };
    loadRoles();
  }, []);

  useEffect(() => {
    const levels = getFlowLevels(selectedModule);
    const activeLevel = levels.includes(flowLevel) ? flowLevel : levels[0];
    setFlowLevel(activeLevel);
    loadNodes(selectedModule, activeLevel);
  }, [selectedModule, loadNodes, flowLevel]);

  useEffect(() => {
    async function fetchFlows() {
      try {
        const res = await fetch("/api/approval-flows");
        if (res.ok) {
          const data = await res.json();
          const mapped: SavedFlows = {};
          for (const item of data) {
            if (!mapped[item.businessType]) mapped[item.businessType] = {};
            mapped[item.businessType][item.flowLevel] = item.nodes;
          }
          setSavedFlows(mapped);
        }
      } catch {
        // 使用默认模板
      }
    }
    fetchFlows();
  }, []);

  const handleModuleSelect = (moduleType: string) => {
    setSelectedModule(moduleType);
    setSaveMsg(null);
  };

  const handleLevelChange = (level: FlowLevel) => {
    setFlowLevel(level);
    loadNodes(selectedModule, level);
    setSaveMsg(null);
  };

  const handleAddNode = () => {
    const newOrder = nodes.length + 1;
    setNodes([...nodes, { nodeOrder: newOrder, nodeName: "", approverRole: "" }]);
  };

  const handleDeleteNode = (index: number) => {
    const updated = nodes.filter((_, i) => i !== index);
    setNodes(updated.map((n, i) => ({ ...n, nodeOrder: i + 1 })));
  };

  const handleNodeNameChange = (index: number, name: string) => {
    const updated = [...nodes];
    updated[index] = { ...updated[index], nodeName: name };
    setNodes(updated);
  };

  const handleRoleChange = (index: number, role: string) => {
    const updated = [...nodes];
    const roleLabel = approverRoles.find((r) => r.value === role)?.label || "";
    updated[index] = {
      ...updated[index],
      approverRole: role,
      nodeName: updated[index].nodeName || roleLabel,
    };
    setNodes(updated);
  };

  const handleSave = async () => {
    const invalid = nodes.find((n) => !n.approverRole);
    if (invalid) {
      setSaveMsg({ type: "error", text: "请为所有节点选择审批角色" });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/approval-flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: selectedModule,
          flowLevel,
          nodes,
        }),
      });
      if (res.ok) {
        setSavedFlows((prev) => ({
          ...prev,
          [selectedModule]: {
            ...prev[selectedModule],
            [flowLevel]: nodes.map((n) => ({ ...n })),
          },
        }));
        setSaveMsg({ type: "success", text: "保存成功" });
      } else {
        setSaveMsg({ type: "error", text: "保存失败，请重试" });
      }
    } catch {
      setSaveMsg({ type: "error", text: "网络错误，请重试" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const defaults = getDefaultNodes(selectedModule, flowLevel);
    setNodes(defaults);
    setSaveMsg(null);
  };

  const handleBatchApply = () => {
    const targets: Record<string, string[]> = {};
    BUSINESS_MODULES.forEach((m) => {
      if (m.type === selectedModule) return;
      targets[m.type] = [];
    });
    setBatchTargets(targets);
    setBatchModalOpen(true);
  };

  const toggleBatchTarget = (moduleType: string, level: string) => {
    setBatchTargets((prev) => {
      const current = prev[moduleType] || [];
      const exists = current.includes(level);
      return {
        ...prev,
        [moduleType]: exists ? current.filter((l) => l !== level) : [...current, level],
      };
    });
  };

  const toggleAllBatchTargets = () => {
    const allSelected = Object.entries(batchTargets).every(([modType, levels]) => {
      const mod = BUSINESS_MODULES.find((m) => m.type === modType)!;
      const modLevels = getFlowLevels(modType);
      return modLevels.every((l) => levels.includes(l));
    });

    const updated: Record<string, string[]> = {};
    BUSINESS_MODULES.forEach((m) => {
      if (m.type === selectedModule) return;
      if (allSelected) {
        updated[m.type] = [];
      } else {
        updated[m.type] = getFlowLevels(m.type);
      }
    });
    setBatchTargets(updated);
  };

  const handleBatchConfirm = async () => {
    setBatchApplying(true);
    try {
      const applyItems: { businessType: string; flowLevel: string; nodes: FlowNode[] }[] = [];
      Object.entries(batchTargets).forEach(([modType, levels]) => {
        levels.forEach((level) => {
          applyItems.push({
            businessType: modType,
            flowLevel: level,
            nodes: nodes.map((n) => ({ ...n })),
          });
        });
      });
      await fetch("/api/approval-flows/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: applyItems }),
      });
      setBatchModalOpen(false);
      setSaveMsg({ type: "success", text: "批量应用成功" });
    } catch {
      setSaveMsg({ type: "error", text: "批量应用失败，请重试" });
    } finally {
      setBatchApplying(false);
    }
  };

  const hasBatchSelection = Object.values(batchTargets).some((l) => l.length > 0);

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Settings2 className="w-7 h-7 text-[#007AFF]" />
          <div>
            <h1>流程设置</h1>
            <p>配置各业务模块的审批流程，支持多级审批和批量应用</p>
          </div>
        </div>
      </div>

      <div className="flex gap-6" style={{ minHeight: "calc(100vh - 180px)" }}>
        {/* 左侧 - 业务模块列表 */}
        <div className="w-[220px] flex-shrink-0">
          <div className="bento-card-static !p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0F0F0]">
              <h3 className="text-[14px] font-bold text-[#1D1D1F]">业务模块</h3>
            </div>
            <div className="py-2 custom-scrollbar" style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
              {BUSINESS_MODULES.map((mod) => (
                <button
                  key={mod.type}
                  onClick={() => handleModuleSelect(mod.type)}
                  className={`w-full flex items-center gap-2.5 px-5 py-3 text-left transition-all duration-150 cursor-pointer ${
                    selectedModule === mod.type
                      ? "bg-[#007AFF]/8 text-[#007AFF]"
                      : "text-[#1D1D1F] hover:bg-[#F5F5F7]"
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      selectedModule === mod.type ? "bg-[#007AFF]" : "bg-[#C7C7CC]"
                    }`}
                  />
                  <span className="text-[13px] font-medium">{mod.name}</span>
                  {mod.hasFlowLevel && (
                    <span className="ios-badge ios-badge-orange !text-[10px] !px-1.5 !py-0 ml-auto">多级</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧 - 流程编辑器 */}
        <div className="flex-1 min-w-0">
          <div className="bento-card-static">
            {/* 标题 + 级别切换 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-[17px] font-bold text-[#1D1D1F]">{currentModule.name} · 审批流程</h2>
                {currentModule.hasFlowLevel && (
                  <div className="flex items-center bg-[#F5F5F7] rounded-xl p-1">
                    {(["project", "company"] as FlowLevel[]).map((level) => (
                      <button
                        key={level}
                        onClick={() => handleLevelChange(level)}
                        className={`px-4 py-1.5 rounded-[10px] text-[13px] font-semibold transition-all duration-200 cursor-pointer ${
                          flowLevel === level
                            ? "bg-white text-[#007AFF] shadow-sm"
                            : "text-[#86868B] hover:text-[#1D1D1F]"
                        }`}
                      >
                        {level === "project" ? "项目级" : "公司级"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[13px] text-[#86868B]">
                共 {nodes.length} 个节点
              </span>
            </div>

            {/* 节点流程图 */}
            <div className="flex flex-col items-center pb-6">
              {/* 开始节点 */}
              <div className="flex flex-col items-center mb-0">
                <div className="px-5 py-2 rounded-full bg-[#34C759]/10 text-[#34C759] text-[13px] font-semibold">
                  发起申请
                </div>
                <div className="w-px h-6 bg-[#D1D1D6]" />
              </div>

              {/* 审批节点 */}
              {nodes.map((node, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-[#E5E5EA] shadow-sm px-5 py-4 w-[420px] transition-all duration-200 hover:shadow-md hover:border-[#007AFF]/30">
                    <div className="flex items-center gap-4">
                      {/* 步骤序号 */}
                      <div className="w-9 h-9 rounded-full bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[15px] text-[#007AFF] font-bold">
                          {CIRCLE_NUMBERS[index] || index + 1}
                        </span>
                      </div>

                      {/* 节点名称 + 角色选择 */}
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <input
                          type="text"
                          value={node.nodeName}
                          onChange={(e) => handleNodeNameChange(index, e.target.value)}
                          placeholder="节点名称"
                          className="ios-input !py-2 !text-[14px] !rounded-xl flex-1 min-w-0"
                        />
                        <div className="relative flex-shrink-0">
                          <select
                            value={node.approverRole}
                            onChange={(e) => handleRoleChange(index, e.target.value)}
                            className="ios-select !py-2 !text-[13px] !rounded-xl !pr-9 min-w-[140px]"
                          >
                            <option value="">选择角色</option>
                            {approverRoles.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* 删除按钮 */}
                      <button
                        onClick={() => handleDeleteNode(index)}
                        className="w-7 h-7 rounded-full bg-[#FF3B30]/8 hover:bg-[#FF3B30]/15 flex items-center justify-center transition-colors duration-150 cursor-pointer flex-shrink-0"
                        title="删除节点"
                      >
                        <X className="w-3.5 h-3.5 text-[#FF3B30]" />
                      </button>
                    </div>
                  </div>

                  {/* 连接线 */}
                  {index < nodes.length - 1 && (
                    <div className="flex flex-col items-center">
                      <div className="w-px h-5 bg-[#D1D1D6]" />
                      <ChevronDown className="w-4 h-4 text-[#C7C7CC] -mt-1" />
                      <div className="w-px h-2 bg-[#D1D1D6]" />
                    </div>
                  )}
                </div>
              ))}

              {/* 结束节点连接线 */}
              {nodes.length > 0 && (
                <div className="flex flex-col items-center">
                  <div className="w-px h-5 bg-[#D1D1D6]" />
                </div>
              )}

              {/* 结束节点 */}
              <div className="px-5 py-2 rounded-full bg-[#8E8E93]/10 text-[#8E8E93] text-[13px] font-semibold">
                流程结束
              </div>
            </div>

            {/* 添加节点 */}
            <div className="flex justify-center mb-6">
              <button
                onClick={handleAddNode}
                className="ios-btn ios-btn-secondary ios-btn-sm gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                添加节点
              </button>
            </div>

            {/* 提示消息 */}
            {saveMsg && (
              <div
                className={`mb-4 p-3 rounded-xl text-[13px] font-medium flex items-center gap-2 ${
                  saveMsg.type === "success"
                    ? "bg-[#34C759]/8 text-[#34C759]"
                    : "bg-[#FF3B30]/8 text-[#FF3B30]"
                }`}
              >
                {saveMsg.type === "success" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {saveMsg.text}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-3 pt-4 border-t border-[#F0F0F0]">
              <button
                onClick={handleSave}
                disabled={saving}
                className="ios-btn ios-btn-primary gap-1.5"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                保存
              </button>
              <button onClick={handleReset} className="ios-btn ios-btn-secondary gap-1.5">
                <RotateCcw className="w-4 h-4" />
                重置默认
              </button>
              <button
                onClick={handleBatchApply}
                className="ios-btn ios-btn-ghost gap-1.5 ml-auto"
              >
                <Copy className="w-4 h-4" />
                批量应用到其他模块
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 批量应用弹窗 */}
      <Modal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title="批量应用审批流程"
        maxWidth="520px"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-[#007AFF]/6 text-[13px] text-[#007AFF] font-medium">
            将「{currentModule.name}」的审批流程应用到以下模块
          </div>

          <div className="flex justify-end">
            <button
              onClick={toggleAllBatchTargets}
              className="ios-btn ios-btn-ghost ios-btn-sm text-[12px]"
            >
              {Object.values(batchTargets).every((l) => l.length > 0) &&
              Object.entries(batchTargets).every(([modType, levels]) => {
                const modLevels = getFlowLevels(modType);
                return modLevels.every((l) => levels.includes(l));
              })
                ? "取消全选"
                : "全选"}
            </button>
          </div>

          <div className="space-y-1 max-h-[360px] overflow-y-auto custom-scrollbar">
            {BUSINESS_MODULES.filter((m) => m.type !== selectedModule).map((mod) => {
              const modLevels = getFlowLevels(mod.type);
              const selectedLevels = batchTargets[mod.type] || [];

              return (
                <div
                  key={mod.type}
                  className="p-3 rounded-xl hover:bg-[#F5F5F7] transition-colors duration-150"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[14px] font-medium text-[#1D1D1F] min-w-[80px]">
                      {mod.name}
                    </span>
                    <div className="flex items-center gap-2">
                      {modLevels.map((level) => {
                        const isSelected = selectedLevels.includes(level);
                        return (
                          <label
                            key={level}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-150 text-[13px] font-medium ${
                              isSelected
                                ? "bg-[#007AFF]/10 text-[#007AFF]"
                                : "bg-[#F5F5F7] text-[#86868B] hover:bg-[#E5E5EA]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="ios-checkbox !w-[18px] !h-[18px]"
                              checked={isSelected}
                              onChange={() => toggleBatchTarget(mod.type, level)}
                            />
                            {level === "project" ? "项目级" : level === "company" ? "公司级" : "通用"}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F0F0F0]">
            <button
              onClick={() => setBatchModalOpen(false)}
              className="ios-btn ios-btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleBatchConfirm}
              disabled={!hasBatchSelection || batchApplying}
              className={`ios-btn gap-1.5 ${
                hasBatchSelection ? "ios-btn-primary" : "ios-btn-secondary opacity-50 cursor-not-allowed"
              }`}
            >
              {batchApplying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              确认应用
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
