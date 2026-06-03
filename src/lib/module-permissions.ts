export const MODULE_KEYS = [
  "business",
  "projects",
  "procurement",
  "contracts",
  "finance",
  "hr",
  "settings",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_MAP: Record<ModuleKey, string> = {
  business: "商务管理",
  projects: "项目管理",
  procurement: "项目采购",
  contracts: "合同管理",
  finance: "财务管理",
  hr: "人事行政",
  settings: "系统设置",
};

export const SECTION_TO_MODULE: Record<string, ModuleKey> = {
  "商务管理": "business",
  "项目管理": "projects",
  "项目采购": "procurement",
  "合同管理": "contracts",
  "财务管理": "finance",
  "人事行政管理": "hr",
  "系统设置": "settings",
};

export const SUB_MODULE_KEYS = [
  "business.customers",
  "business.suppliers",
  "business.project_leads",
  "business.biddings",
  "business.quotations",
  "projects.list",
  "projects.plans",
  "projects.progress",
  "projects.outsourcing",
  "procurement.requests",
  "procurement.inquiries",
  "procurement.deliveries",
  "contracts.income",
  "contracts.expense",
  "finance.income",
  "finance.expense",
  "finance.invoices",
  "finance.reports",
  "finance.bank_accounts",
  "finance.income.contract",
  "finance.income.other",
  "finance.income.shareholder",
  "finance.income.borrowing",
  "finance.expense.contract",
  "finance.expense.other",
  "finance.expense.lending",
  "finance.expense.report",
  "finance.expense.salary",
  "finance.expense.return",
  "hr.employees",
  "hr.supplies",
  "hr.certificates",
  "hr.seals",
] as const;

export type SubModuleKey = (typeof SUB_MODULE_KEYS)[number];

export const SUB_MODULE_MAP: Record<SubModuleKey, { parent: string; label: string }> = {
  "business.customers": { parent: "business", label: "客户管理" },
  "business.suppliers": { parent: "business", label: "供应商管理" },
  "business.project_leads": { parent: "business", label: "市场开发" },
  "business.biddings": { parent: "business", label: "投标统计" },
  "business.quotations": { parent: "business", label: "报价统计" },
  "projects.list": { parent: "projects", label: "项目立项" },
  "projects.plans": { parent: "projects", label: "项目计划" },
  "projects.progress": { parent: "projects", label: "项目进度" },
  "projects.outsourcing": { parent: "projects", label: "设计外包" },
  "procurement.requests": { parent: "procurement", label: "采购需求" },
  "procurement.inquiries": { parent: "procurement", label: "采购单" },
  "procurement.deliveries": { parent: "procurement", label: "到货验收" },
  "contracts.income": { parent: "contracts", label: "收入合同" },
  "contracts.expense": { parent: "contracts", label: "支出合同" },
  "finance.income": { parent: "finance", label: "财务收入" },
  "finance.expense": { parent: "finance", label: "财务支出" },
  "finance.invoices": { parent: "finance", label: "发票管理" },
  "finance.reports": { parent: "finance", label: "财务报表" },
  "finance.bank_accounts": { parent: "finance", label: "银行账户" },
  "finance.income.contract": { parent: "finance.income", label: "合同收入" },
  "finance.income.other": { parent: "finance.income", label: "其他收入" },
  "finance.income.shareholder": { parent: "finance.income", label: "股东出资" },
  "finance.income.borrowing": { parent: "finance.income", label: "其他借入款" },
  "finance.expense.contract": { parent: "finance.expense", label: "合同支出" },
  "finance.expense.other": { parent: "finance.expense", label: "其他支出" },
  "finance.expense.lending": { parent: "finance.expense", label: "借出款" },
  "finance.expense.report": { parent: "finance.expense", label: "费用报销" },
  "finance.expense.salary": { parent: "finance.expense", label: "工资发放" },
  "finance.expense.return": { parent: "finance.expense", label: "借入资金归还" },
  "hr.employees": { parent: "hr", label: "员工档案" },
  "hr.supplies": { parent: "hr", label: "办公用品" },
  "hr.certificates": { parent: "hr", label: "证照管理" },
  "hr.seals": { parent: "hr", label: "印章管理" },
};

export const MODULE_SUB_ITEMS: Record<ModuleKey, { key: SubModuleKey; label: string }[]> = {
  business: [
    { key: "business.customers", label: "客户管理" },
    { key: "business.suppliers", label: "供应商管理" },
    { key: "business.project_leads", label: "市场开发" },
    { key: "business.biddings", label: "投标统计" },
    { key: "business.quotations", label: "报价统计" },
  ],
  projects: [
    { key: "projects.list", label: "项目立项" },
    { key: "projects.plans", label: "项目计划" },
    { key: "projects.progress", label: "项目进度" },
    { key: "projects.outsourcing", label: "设计外包" },
  ],
  procurement: [
    { key: "procurement.requests", label: "采购需求" },
    { key: "procurement.inquiries", label: "采购单" },
    { key: "procurement.deliveries", label: "到货验收" },
  ],
  contracts: [
    { key: "contracts.income", label: "收入合同" },
    { key: "contracts.expense", label: "支出合同" },
  ],
  finance: [
    { key: "finance.income", label: "财务收入" },
    { key: "finance.expense", label: "财务支出" },
    { key: "finance.invoices", label: "发票管理" },
    { key: "finance.reports", label: "财务报表" },
    { key: "finance.bank_accounts", label: "银行账户" },
  ],
  hr: [
    { key: "hr.employees", label: "员工档案" },
    { key: "hr.supplies", label: "办公用品" },
    { key: "hr.certificates", label: "证照管理" },
    { key: "hr.seals", label: "印章管理" },
  ],
  settings: [],
};

export const SUB_MODULE_TO_HREF: Record<SubModuleKey, string> = {
  "business.customers": "/business/customers",
  "business.suppliers": "/business/suppliers",
  "business.project_leads": "/business/project-leads",
  "business.biddings": "/business/biddings",
  "business.quotations": "/business/quotations",
  "projects.list": "/projects",
  "projects.plans": "/projects/plans",
  "projects.progress": "/projects/progress",
  "projects.outsourcing": "/projects/outsourcing",
  "procurement.requests": "/procurement/requests",
  "procurement.inquiries": "/procurement/inquiries",
  "procurement.deliveries": "/procurement/deliveries",
  "contracts.income": "/contracts/income",
  "contracts.expense": "/contracts/expense",
  "finance.income": "/finance/income",
  "finance.expense": "/finance/expense",
  "finance.invoices": "/finance/invoices",
  "finance.reports": "/finance/reports",
  "finance.bank_accounts": "/finance/bank-accounts",
  "finance.income.contract": "/finance/income",
  "finance.income.other": "/finance/income",
  "finance.income.shareholder": "/finance/income",
  "finance.income.borrowing": "/finance/income",
  "finance.expense.contract": "/finance/expense",
  "finance.expense.other": "/finance/expense",
  "finance.expense.lending": "/finance/expense",
  "finance.expense.report": "/finance/expense",
  "finance.expense.salary": "/finance/expense",
  "finance.expense.return": "/finance/expense",
  "hr.employees": "/hr/employees",
  "hr.supplies": "/admin/supplies",
  "hr.certificates": "/admin/certificates",
  "hr.seals": "/admin/seals",
};

export interface UserModulePermission {
  accessibleModules: ModuleKey[];
  accessibleSubModules: SubModuleKey[];
  isGlobalVisible: boolean;
}

export function resolveUserPermissions(
  roles: { modulePermissions: string; isGlobalVisible: boolean }[]
): UserModulePermission {
  const moduleSet = new Set<ModuleKey>();
  const subModuleSet = new Set<SubModuleKey>();
  let isGlobalVisible = false;

  for (const role of roles) {
    if (role.isGlobalVisible) {
      isGlobalVisible = true;
    }

    let moduleKeys: string[];
    try {
      const perms = JSON.parse(role.modulePermissions || "{}");
      moduleKeys = Object.keys(perms);
    } catch {
      moduleKeys = [];
    }

    for (const m of moduleKeys) {
      if (MODULE_KEYS.includes(m as ModuleKey)) {
        moduleSet.add(m as ModuleKey);
      }
      if (SUB_MODULE_KEYS.includes(m as SubModuleKey)) {
        subModuleSet.add(m as SubModuleKey);
      }
    }
  }

  if (isGlobalVisible) {
    return {
      accessibleModules: [...MODULE_KEYS],
      accessibleSubModules: [...SUB_MODULE_KEYS],
      isGlobalVisible: true,
    };
  }

  return {
    accessibleModules: [...moduleSet],
    accessibleSubModules: [...subModuleSet],
    isGlobalVisible: false,
  };
}

export function canAccessModule(
  permissions: UserModulePermission,
  moduleKey: ModuleKey
): boolean {
  if (permissions.isGlobalVisible) return true;
  return permissions.accessibleModules.includes(moduleKey);
}

export function canAccessSubModule(
  permissions: UserModulePermission,
  subModuleKey: SubModuleKey
): boolean {
  if (permissions.isGlobalVisible) return true;
  return permissions.accessibleSubModules.includes(subModuleKey);
}

export function needsProjectIsolation(
  permissions: UserModulePermission,
  moduleKey: ModuleKey
): boolean {
  if (permissions.isGlobalVisible) return false;
  return (moduleKey === "projects" || moduleKey === "procurement");
}

// === 业务模块定义（供流程设置页面使用）===
export interface BusinessModule {
  type: string;       // 模块 key
  name: string;       // 显示名称
}

export interface BusinessModuleGroup {
  label: string;      // 分组名称（如"商务管理"）
  modules: BusinessModule[];
}

// 流程设置页面需要的业务模块分组
// 有审批流需求的模块列表
export const BUSINESS_MODULE_GROUPS: BusinessModuleGroup[] = [
  {
    label: "商务管理",
    modules: [
      { type: "quotation", name: "商务报价" },
      { type: "supplier", name: "供应商审批" },
    ],
  },
  {
    label: "项目管理",
    modules: [
      { type: "outsourcing", name: "外包任务" },
    ],
  },
  {
    label: "项目采购",
    modules: [
      { type: "purchase_request", name: "采购需求" },
      { type: "delivery_receipt", name: "到货验收" },
    ],
  },
  {
    label: "合同管理",
    modules: [
      { type: "income_contract", name: "收入合同" },
      { type: "expense_contract", name: "支出合同" },
    ],
  },
  {
    label: "财务管理 · 支出",
    modules: [
      { type: "non_contract_expense", name: "其他支付" },
      { type: "payment_application", name: "合同支付" },
      { type: "lending_out", name: "借出款" },
      { type: "expense_report", name: "费用报销" },
      { type: "salary_payment", name: "工资发放" },
      { type: "borrowing_return_application", name: "借入资金归还" },
    ],
  },
];

export const BUSINESS_MODULES = BUSINESS_MODULE_GROUPS.flatMap((g) => g.modules);
