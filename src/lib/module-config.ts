/**
 * 业务模块配置 — 集中定义支持审批流的业务模块
 *
 * 只有在此处注册的模块才会出现在"流程设置"侧边栏中。
 * 新增审批流模块时在此加一条记录，无需改其他代码。
 */
export interface ModuleConfigItem {
  key: string    // 模块唯一标识，与 ApprovalFlowDefinition.businessType 对应
  name: string   // 模块显示名称
  group: string  // 所属分组
}

export const MODULE_CONFIG: ModuleConfigItem[] = [
  // === 商务管理 ===
  { key: "supplier",                name: "供应商审批",     group: "商务管理" },
  { key: "supplier_change",        name: "供应商变更",     group: "商务管理" },

  // === 项目管理 ===
  { key: "outsourcing",             name: "设计外包",       group: "项目管理" },

  // === 项目采购 ===
  { key: "purchase_request",        name: "采购需求",       group: "项目采购" },
  { key: "inquiries",               name: "采购单",         group: "项目采购" },
  { key: "delivery_receipt",        name: "到货验收",       group: "项目采购" },

  // === 合同管理 ===
  { key: "income_contract",         name: "收入合同",       group: "合同管理" },
  { key: "expense_contract",        name: "支出合同",       group: "合同管理" },
  { key: "inter_org_contract",      name: "内部结算合同",   group: "合同管理" },
  { key: "contract_change_order",   name: "合同变更",       group: "合同管理" },

  // === 财务管理 · 支出 ===
  { key: "non_contract_expense",    name: "其他支付",       group: "财务管理" },
  { key: "payment_application",     name: "合同支付",       group: "财务管理" },
  { key: "lending_out",             name: "借出款",         group: "财务管理" },
  { key: "expense_report",          name: "费用报销",       group: "财务管理" },
  { key: "salary_payment",          name: "工资发放",       group: "财务管理" },
  { key: "borrowing_return_application", name: "借入资金归还", group: "财务管理" },
]

/** 包含流程状态的模块信息 */
export interface ModuleWithFlowStatus {
  moduleKey: string
  moduleName: string
  groupName: string
  hasFlow: boolean
}

/**
 * 根据 flowCounts 映射，给 MODULE_CONFIG 中的每个模块注入 hasFlow 状态。
 * 纯函数，无副作用，便于测试。
 */
export function getModulesWithFlowStatus(
  flowCounts: Record<string, number>
): ModuleWithFlowStatus[] {
  return MODULE_CONFIG.map((m) => ({
    moduleKey: m.key,
    moduleName: m.name,
    groupName: m.group,
    hasFlow: (flowCounts[m.key] || 0) > 0,
  }))
}
