"use client";

import { useState, useEffect } from "react";
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

const CONTRACT_MODULES = ["income_contract", "expense_contract", "inter_org_contract", "contract_change_order"];

const FINANCE_MODULES = [
  "non_contract_expense", "payment_application", "expense_report",
  "lending_out", "salary_payment", "borrowing_return_application",
];

function getTerminalNodeType(moduleType: string): "archive" | "payment" | null {
  if (CONTRACT_MODULES.includes(moduleType)) return "archive";
  if (FINANCE_MODULES.includes(moduleType)) return "payment";
  return null;
}

const APPROVER_ROLES_FALLBACK: { value: string; label: string }[] = [];

const CIRCLE_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];

interface FlowNode {
  nodeOrder: number;
  nodeName: string;
  approverRole: string;
  nodeType?: "approval" | "archive" | "payment";
}

function parseRoles(roleStr: string): string[] {
  if (!roleStr) return [];
  return roleStr.split(",").map((r) => r.trim()).filter(Boolean);
}

function joinRoles(roles: string[]): string {
  return roles.join(",");
}

function getNodeDisplayName(node: FlowNode, approverRoles: { value: string; label: string }[]): string {
  const roles = parseRoles(node.approverRole);
  if (roles.length === 0) return "未配置角色";
  return roles.map((r) => approverRoles.find((ar) => ar.value === r)?.label || r).join("、");
}

type FlowLevel = "common";

interface SavedFlows {
  [key: string]: FlowNode[];
}

interface ModuleGroup {
  label: string;
  modules: { type: string; name: string }[];
}

export default function ApprovalFlowPage() {
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [moduleGroups, setModuleGroups] = useState<ModuleGroup[]>([]);
  const [flowLevel, setFlowLevel] = useState<FlowLevel>("common");
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [savedFlows, setSavedFlows] = useState<SavedFlows>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchTargets, setBatchTargets] = useState<Record<string, string[]>>({});
  const [batchApplying, setBatchApplying] = useState(false);
  const [approverRoles, setApproverRoles] = useState(APPROVER_ROLES_FALLBACK);
  // 编辑缓存：切换模块时保留未保存的编辑内容
  const [editCache, setEditCache] = useState<Record<string, FlowNode[]>>({});

  const currentModule = moduleGroups.flatMap(g => g.modules).find((m) => m.type === selectedModule);

  useEffect(() => {
    // 从 API 加载模块列表和流程数据
    (async () => {
      try {
        // 1. 加载模块列表
        const modRes = await fetch("/api/approval-module-config");
        const modJson = await modRes.json();
        const data: { moduleKey: string; moduleName: string; groupName: string; hasFlow: boolean }[] = modJson.data || [];
        const grouped: Record<string, { type: string; name: string }[]> = {};
        for (const m of data) {
          if (!grouped[m.groupName]) grouped[m.groupName] = [];
          grouped[m.groupName].push({ type: m.moduleKey, name: m.moduleName });
        }
        const groups = Object.entries(grouped).map(([label, modules]) => ({ label, modules }));
        setModuleGroups(groups);

        const firstModule = data.length > 0 ? data[0].moduleKey : "";
        if (firstModule) {
          setSelectedModule(firstModule);
        }

        // 2. 加载所有模块的流程数据
        const flowRes = await fetch("/api/approval-flows?flowLevel=common");
        if (flowRes.ok) {
          const flowJson = await flowRes.json();
          const records: Array<{ businessType: string; nodeOrder: number; nodeName: string; approverRole: string; nodeType?: string }> = flowJson.data || [];
          const flowGrouped: Record<string, Array<{ nodeOrder: number; nodeName: string; approverRole: string; nodeType?: string }>> = {};
          for (const rec of records) {
            if (!flowGrouped[rec.businessType]) flowGrouped[rec.businessType] = [];
            flowGrouped[rec.businessType].push({
              nodeOrder: rec.nodeOrder,
              nodeName: rec.nodeName,
              approverRole: rec.approverRole,
              nodeType: rec.nodeType,
            });
          }
          const mapped: SavedFlows = {};
          for (const [bt, flowNodes] of Object.entries(flowGrouped)) {
            mapped[bt] = flowNodes.sort((a, b) => a.nodeOrder - b.nodeOrder).map((n) => ({
              ...n,
              nodeType: n.nodeType as "approval" | "archive" | "payment" | undefined,
            }));
          }
          setSavedFlows(mapped);
          // 用第一个模块的 key 正确设置 nodes
          const initial = mapped[firstModule];
          setNodes(initial ? initial.map((n) => ({ ...n })) : []);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const res = await fetch("/api/roles");
        if (res.ok) {
          const { data } = await res.json();
          if (data) {
            setApproverRoles(data.map((r: { code: string; name: string }) => ({
              value: r.code,
              label: r.name,
            })));
          }
        }
      } catch {}
    };
    loadRoles();
  }, []);

  // 重新加载所有模块的流程数据，并刷新当前选中模块的显示
  const refreshFlows = async (currentModule: string) => {
    try {
      const res = await fetch("/api/approval-flows?flowLevel=common");
      if (res.ok) {
        const json = await res.json();
        const records: Array<{ businessType: string; nodeOrder: number; nodeName: string; approverRole: string; nodeType?: string }> = json.data || [];
        const grouped: Record<string, Array<{ nodeOrder: number; nodeName: string; approverRole: string; nodeType?: string }>> = {};
        for (const rec of records) {
          if (!grouped[rec.businessType]) grouped[rec.businessType] = [];
          grouped[rec.businessType].push({
            nodeOrder: rec.nodeOrder,
            nodeName: rec.nodeName,
            approverRole: rec.approverRole,
            nodeType: rec.nodeType,
          });
        }
        const mapped: SavedFlows = {};
        for (const [bt, flowNodes] of Object.entries(grouped)) {
          mapped[bt] = flowNodes.sort((a, b) => a.nodeOrder - b.nodeOrder).map((n) => ({
            ...n,
            nodeType: n.nodeType as "approval" | "archive" | "payment" | undefined,
          }));
        }
        setSavedFlows(mapped);
        // 用传入的 currentModule（而非闭包中的 selectedModule）确保拿到正确值
        const initial = mapped[currentModule];
        setNodes(initial ? initial.map((n) => ({ ...n })) : []);
      }
    } catch {}
  };

  const handleModuleSelect = (moduleType: string) => {
    if (moduleType === selectedModule) return;

    // 保存当前模块的编辑内容到缓存
    if (selectedModule) {
      setEditCache((prev) => ({ ...prev, [selectedModule]: nodes.map((n) => ({ ...n })) }));
    }

    // 从缓存或已保存数据加载目标模块的节点
    const cached = editCache[moduleType];
    if (cached) {
      setNodes(cached.map((n) => ({ ...n })));
    } else {
      const saved = savedFlows[moduleType];
      setNodes(saved ? saved.map((n) => ({ ...n })) : []);
    }

    setSelectedModule(moduleType);
    setSaveMsg(null);
  };

  const handleAddNode = () => {
    const newOrder = nodes.length + 1;
    setNodes([...nodes, { nodeOrder: newOrder, nodeName: "", approverRole: "", nodeType: "approval" }]);
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

  const handleToggleRole = (index: number, roleCode: string) => {
    const updated = [...nodes];
    const currentRoles = parseRoles(updated[index].approverRole);
    const newRoles = currentRoles.includes(roleCode)
      ? currentRoles.filter((r) => r !== roleCode)
      : [...currentRoles, roleCode];
    updated[index] = {
      ...updated[index],
      approverRole: joinRoles(newRoles),
    };
    setNodes(updated);
  };

  const handleSave = async () => {
    const terminalType = getTerminalNodeType(selectedModule);
    const processedNodes: FlowNode[] = nodes.map((n, i) => ({
      ...n,
      nodeType: (i === nodes.length - 1 && terminalType ? terminalType : "approval") as "approval" | "archive" | "payment",
    }));

    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/approval-flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: selectedModule,
          flowLevel,
          nodes: processedNodes,
        }),
      });
      if (res.ok) {
        setSavedFlows((prev) => ({
          ...prev,
          [selectedModule]: processedNodes.map((n) => ({ ...n })),
        }));
        setNodes(processedNodes);
        setSaveMsg({ type: "success", text: "保存成功" });
      } else {
        const errData = await res.json().catch(() => null);
        setSaveMsg({ type: "error", text: errData?.error || "保存失败，请重试" });
      }
    } catch {
      setSaveMsg({ type: "error", text: "网络错误，请重试" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setNodes([]);
    setSaveMsg(null);
  };

  const handleBatchApply = async () => {
    // 先自动保存当前模块的流程，确保批量应用时源数据已入库
    const terminalType = getTerminalNodeType(selectedModule);
    const processedNodes: FlowNode[] = nodes.map((n, i) => ({
      ...n,
      nodeType: (i === nodes.length - 1 && terminalType ? terminalType : "approval") as "approval" | "archive" | "payment",
    }));

    if (processedNodes.length > 0) {
      try {
        const res = await fetch("/api/approval-flows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessType: selectedModule,
            flowLevel,
            nodes: processedNodes,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          setSaveMsg({ type: "error", text: errData?.error || "保存当前流程失败，无法批量应用" });
          return;
        }
        // 同步本地缓存
        setSavedFlows((prev) => ({
          ...prev,
          [selectedModule]: processedNodes.map((n) => ({ ...n })),
        }));
        setNodes(processedNodes);
      } catch {
        setSaveMsg({ type: "error", text: "网络错误，无法批量应用" });
        return;
      }
    }

    const targets: Record<string, string[]> = {};
    const allModules = moduleGroups.flatMap(g => g.modules);
    allModules.forEach((m) => {
      if (m.type === selectedModule) return;
      targets[m.type] = [];
    });
    setBatchTargets(targets);
    setBatchModalOpen(true);
  };

  const toggleBatchTarget = (moduleType: string) => {
    setBatchTargets((prev) => {
      const current = prev[moduleType] || [];
      const isSelected = current.includes("common");
      return {
        ...prev,
        [moduleType]: isSelected ? [] : ["common"],
      };
    });
  };

  const toggleAllBatchTargets = () => {
    const allSelected = Object.values(batchTargets).every((levels) => levels.includes("common"));

    const allModules2 = moduleGroups.flatMap(g => g.modules);
    const updated: Record<string, string[]> = {};
    allModules2.forEach((m) => {
      if (m.type === selectedModule) return;
      updated[m.type] = allSelected ? [] : ["common"];
    });
    setBatchTargets(updated);
  };

  const handleBatchConfirm = async () => {
    setBatchApplying(true);
    try {
      const targets: { businessType: string; flowLevel: string }[] = [];
      Object.entries(batchTargets).forEach(([modType, levels]) => {
        levels.forEach((level) => {
          targets.push({ businessType: modType, flowLevel: level });
        });
      });

      const res = await fetch("/api/approval-flows/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceBusinessType: selectedModule,
          sourceFlowLevel: "common",
          targets,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "批量应用失败");
      }

      setBatchModalOpen(false);
      setSaveMsg({ type: "success", text: "批量应用成功" });
      // 清空编辑缓存（批量应用改变了多个模块的数据，旧缓存已失效）
      setEditCache({});
      // 刷新流程数据，确保所有模块（含源模块）显示最新状态
      await refreshFlows(selectedModule);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "批量应用失败，请重试";
      setSaveMsg({ type: "error", text: msg });
    } finally {
      setBatchApplying(false);
    }
  };

  const hasBatchSelection = Object.values(batchTargets).some((l) => l.length > 0);

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Settings2 className="w-7 h-7 text-[#1C1917]" />
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
            <div className="px-5 py-4 border-b border-[#F5F5F4]">
              <h3 className="text-[14px] font-bold text-[#1C1917]">业务模块</h3>
            </div>
            <div className="py-2 custom-scrollbar" style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
              {moduleGroups.map((group) => (
                <div key={group.label}>
                  <div className="px-5 py-2">
                    <span className="text-[11px] font-semibold text-[#78716C] uppercase tracking-wider">{group.label}</span>
                  </div>
                  {group.modules.map((mod) => (
                    <button
                      key={mod.type}
                      onClick={() => handleModuleSelect(mod.type)}
                      className={`w-full flex items-center gap-2.5 px-5 py-2.5 text-left transition-all duration-150 cursor-pointer ${
                        selectedModule === mod.type
                          ? "bg-[#1C1917]/8 text-[#1C1917]"
                          : "text-[#1C1917] hover:bg-[#FAFAF9]"
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          selectedModule === mod.type ? "bg-[#1C1917]" : "bg-[#A8A29E]"
                        }`}
                      />
                      <span className="text-[13px] font-medium">{mod.name}</span>
                    </button>
                  ))}
                </div>
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
                <h2 className="text-[17px] font-bold text-[#1C1917]">{currentModule?.name || ""} · 审批流程</h2>
              </div>
              <span className="text-[13px] text-[#78716C]">
                共 {nodes.length} 个节点
              </span>
            </div>

            {/* 节点流程图 */}
            <div className="flex flex-col items-center pb-6">
              {/* 开始节点 */}
              <div className="flex flex-col items-center mb-0">
                <div className="px-5 py-2 rounded-full bg-[#78716C]/10 text-[#78716C] text-[13px] font-semibold">
                  发起申请
                </div>
                <div className="w-px h-6 bg-[#D1D5DB]" />
              </div>

              {/* 审批节点 */}
              {nodes.map((node, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-[#E7E5E4] shadow-sm px-5 py-4 w-[480px] transition-all duration-200 hover:shadow-md hover:border-[#1C1917]/30">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[15px] text-[#1C1917] font-bold">
                          {CIRCLE_NUMBERS[index] || index + 1}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <input
                          type="text"
                          value={node.nodeName}
                          onChange={(e) => handleNodeNameChange(index, e.target.value)}
                          placeholder="节点名称，如：总经理审批"
                          className="ios-input !py-2 !text-[14px] !rounded-xl w-[140px] flex-shrink-0"
                        />
                        {index === nodes.length - 1 && getTerminalNodeType(selectedModule) && (
                          <span className={`ios-badge text-[12px] whitespace-nowrap ${
                            getTerminalNodeType(selectedModule) === "archive"
                              ? "ios-badge-purple"
                              : "ios-badge-blue"
                          }`}>
                            {getTerminalNodeType(selectedModule) === "archive" ? "归档" : "支付"}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteNode(index)}
                        className="w-7 h-7 rounded-full bg-[#78716C]/8 hover:bg-[#78716C]/15 flex items-center justify-center transition-colors duration-150 cursor-pointer flex-shrink-0"
                        title="删除节点"
                      >
                        <X className="w-3.5 h-3.5 text-[#78716C]" />
                      </button>
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#F5F5F4]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[12px] font-semibold text-[#78716C]">
                          {index === 0 ? "发起角色（有权限发起此流程的角色）" : "审批角色（会签：同角色所有用户都需审批）"}
                        </span>
                        <span className="text-[11px] text-[#78716C]">
                          已选 {parseRoles(node.approverRole).length} 个
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {approverRoles.map((role) => {
                          const selected = parseRoles(node.approverRole).includes(role.value);
                          return (
                            <label
                              key={role.value}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-150 text-[12px] font-medium ${
                                selected
                                  ? "bg-[#1C1917]/10 text-[#1C1917]"
                                  : "bg-[#FAFAF9] text-[#6E6E73] hover:bg-[#E7E5E4]"
                              }`}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                                  selected ? "border-[#1C1917] bg-[#1C1917]" : "border-[#D1D5DB] bg-white"
                                }`}
                              >
                                {selected && <span className="w-1 h-1 rounded-full bg-white" />}
                              </span>
                              {role.label}
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={selected}
                                onChange={() => handleToggleRole(index, role.value)}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 连接线 */}
                  {index < nodes.length - 1 && (
                    <div className="flex flex-col items-center">
                      <div className="w-px h-5 bg-[#D1D5DB]" />
                      <ChevronDown className="w-4 h-4 text-[#A8A29E] -mt-1" />
                      <div className="w-px h-2 bg-[#D1D5DB]" />
                    </div>
                  )}
                </div>
              ))}

              {/* 结束节点连接线 */}
              {nodes.length > 0 && (
                <div className="flex flex-col items-center">
                  <div className="w-px h-5 bg-[#D1D5DB]" />
                </div>
              )}

              {/* 结束节点 */}
              <div className="px-5 py-2 rounded-full bg-[#78716C]/10 text-[#78716C] text-[13px] font-semibold">
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
                    ? "bg-[#78716C]/8 text-[#78716C]"
                    : "bg-[#78716C]/8 text-[#78716C]"
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
            <div className="flex items-center gap-3 pt-4 border-t border-[#F5F5F4]">
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
                清空流程
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
          <div className="p-3 rounded-xl bg-[#1C1917]/6 text-[13px] text-[#1C1917] font-medium">
            将「{currentModule?.name || ""}」的审批流程应用到以下模块
          </div>

          <div className="flex justify-end">
            <button
              onClick={toggleAllBatchTargets}
              className="ios-btn ios-btn-ghost ios-btn-sm text-[12px]"
            >
              {Object.values(batchTargets).every((l) => l.includes("common"))
                ? "取消全选"
                : "全选"}
            </button>
          </div>

          <div className="space-y-1 max-h-[360px] overflow-y-auto custom-scrollbar">
            {moduleGroups.flatMap(g => g.modules).filter((m) => m.type !== selectedModule).map((mod) => {
              const selectedLevels = batchTargets[mod.type] || [];
              const isSelected = selectedLevels.includes("common");

              return (
                <div
                  key={mod.type}
                  className="p-3 rounded-xl hover:bg-[#FAFAF9] transition-colors duration-150"
                >
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="ios-checkbox !w-[18px] !h-[18px]"
                      checked={isSelected}
                      onChange={() => toggleBatchTarget(mod.type)}
                    />
                    <span className="text-[14px] font-medium text-[#1C1917]">
                      {mod.name}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
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
