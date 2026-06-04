/**
 * 业务模块配置 — 集中定义所有业务模块
 *
 * 新加模块时只需在此处加一条记录，然后运行 seed 脚本同步到数据库。
 * 审批流程配置页、权限校验等均从数据库读取，无需改其他代码。
 */
export interface ModuleConfigItem {
  key: string    // 模块唯一标识，与 ApprovalFlowDefinition.businessType 对应
  name: string   // 模块显示名称
  group: string  // 所属分组
}

export const MODULE_CONFIG: ModuleConfigItem[] = [
  // === 商务管理 ===
  { key: "customers",               name: "客户管理",       group: "商务管理" },
  { key: "supplier",                name: "供应商审批",     group: "商务管理" },
  { key: "project_leads",           name: "市场开发",       group: "商务管理" },
  { key: "biddings",                name: "投标统计",       group: "商务管理" },
  { key: "quotation",               name: "商务报价",       group: "商务管理" },

  // === 项目管理 ===
  { key: "projects_list",           name: "项目立项",       group: "项目管理" },
  { key: "projects_plans",          name: "项目计划",       group: "项目管理" },
  { key: "projects_progress",       name: "项目进度",       group: "项目管理" },
  { key: "outsourcing",             name: "设计外包",       group: "项目管理" },

  // === 项目采购 ===
  { key: "purchase_request",        name: "采购需求",       group: "项目采购" },
  { key: "inquiries",               name: "采购单",         group: "项目采购" },
  { key: "delivery_receipt",        name: "到货验收",       group: "项目采购" },

  // === 合同管理 ===
  { key: "income_contract",         name: "收入合同",       group: "合同管理" },
  { key: "expense_contract",        name: "支出合同",       group: "合同管理" },

  // === 财务管理 · 收入 ===
  { key: "non_contract_income",     name: "非合同收入",     group: "财务管理" },
  { key: "other_borrowing",         name: "其他借入款",     group: "财务管理" },

  // === 财务管理 · 支出 ===
  { key: "non_contract_expense",    name: "其他支付",       group: "财务管理" },
  { key: "payment_application",     name: "合同支付",       group: "财务管理" },
  { key: "lending_out",             name: "借出款",         group: "财务管理" },
  { key: "expense_report",          name: "费用报销",       group: "财务管理" },
  { key: "salary_payment",          name: "工资发放",       group: "财务管理" },
  { key: "borrowing_return_application", name: "借入资金归还", group: "财务管理" },

  // === 人事行政 ===
  { key: "hr_employees",            name: "员工档案",       group: "人事行政" },
  { key: "office_supplies",         name: "办公用品",       group: "人事行政" },
  { key: "certificates",            name: "证照管理",       group: "人事行政" },
  { key: "seals",                   name: "印章管理",       group: "人事行政" },
]
