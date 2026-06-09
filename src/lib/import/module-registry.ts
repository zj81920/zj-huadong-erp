// src/lib/import/module-registry.ts
import type { ImportModule } from "./types";

export interface ModuleFieldDef {
  field: string;
  label: string;
  type: "string" | "date" | "decimal" | "lookup";
  required: boolean;
  defaultValue?: string;
  lookup?: {
    type: "customer" | "supplier" | "project" | "contract" | "organization";
    prismaModel: string;
    nameField: string;
    idField: string;
  };
  enumValues?: string[];
}

export interface ModuleImportConfig {
  module: ImportModule;
  moduleName: string;
  /** 导入依赖的模块（必须先导这些模块） */
  dependsOn: ImportModule[];
  fields: ModuleFieldDef[];
  /** 默认的 AI 提示前缀 */
  aiPromptContext: string;
}

export const MODULE_REGISTRY: Record<ImportModule, ModuleImportConfig> = {
  customers: {
    module: "customers",
    moduleName: "客户",
    dependsOn: [],
    fields: [
      { field: "name", label: "客户名称", type: "string", required: true },
      { field: "contactPerson", label: "联系人", type: "string", required: false },
      { field: "phone", label: "联系电话", type: "string", required: false },
      { field: "email", label: "邮箱", type: "string", required: false },
      { field: "address", label: "地址", type: "string", required: false },
      { field: "industryType", label: "行业类型", type: "string", required: false },
      { field: "customerGrade", label: "客户等级", type: "string", required: false, defaultValue: "C" },
    ],
    aiPromptContext: "客户基础信息，包含客户名称、联系人、联系方式等",
  },
  suppliers: {
    module: "suppliers",
    moduleName: "供应商",
    dependsOn: [],
    fields: [
      { field: "name", label: "供应商名称", type: "string", required: true },
      { field: "contactPerson", label: "联系人", type: "string", required: false },
      { field: "phone", label: "联系电话", type: "string", required: false },
    ],
    aiPromptContext: "供应商基础信息",
  },
  projects: {
    module: "projects",
    moduleName: "项目",
    dependsOn: ["customers"],
    fields: [
      { field: "projectCode", label: "项目编号", type: "string", required: true },
      { field: "name", label: "项目名称", type: "string", required: true },
      { field: "customerName", label: "客户名称", type: "lookup", required: true,
        lookup: { type: "customer", prismaModel: "customer", nameField: "name", idField: "id" } },
      { field: "type", label: "项目类型", type: "string", required: false },
      { field: "projectCategory", label: "项目分类", type: "string", required: false },
      { field: "address", label: "地址", type: "string", required: false },
      { field: "status", label: "项目状态", type: "string", required: false, defaultValue: "执行",
        enumValues: ["执行", "完工", "暂停"] },
      { field: "startDate", label: "开始日期", type: "date", required: false },
      { field: "plannedEndDate", label: "计划结束日期", type: "date", required: false },
      { field: "actualCloseDate", label: "实际关闭日期", type: "date", required: false },
      { field: "organizationName", label: "经营主体", type: "lookup", required: false,
        lookup: { type: "organization", prismaModel: "organization", nameField: "name", idField: "id" } },
    ],
    aiPromptContext: "项目信息，导入时系统会自动创建对应的项目线索记录（来源=直接委托，状态=已立项）",
  },
  "income-contracts": {
    module: "income-contracts",
    moduleName: "收入合同",
    dependsOn: ["customers", "projects"],
    fields: [
      { field: "contractNo", label: "合同编号", type: "string", required: true },
      { field: "customerName", label: "客户名称", type: "lookup", required: true,
        lookup: { type: "customer", prismaModel: "customer", nameField: "name", idField: "id" } },
      { field: "projectSourceId", label: "项目编号", type: "lookup", required: false,
        lookup: { type: "project", prismaModel: "project", nameField: "projectCode", idField: "projectSourceId" } },
      { field: "signedDate", label: "签约日期", type: "date", required: false },
      { field: "totalAmount", label: "合同金额", type: "decimal", required: true },
      { field: "taxRate", label: "税率", type: "string", required: false },
      { field: "pricingMethod", label: "计价方式", type: "string", required: false },
      { field: "contractSummary", label: "合同摘要", type: "string", required: false },
      { field: "paymentTerms", label: "付款条款", type: "string", required: false },
      { field: "organizationName", label: "经营主体", type: "lookup", required: false,
        lookup: { type: "organization", prismaModel: "organization", nameField: "name", idField: "id" } },
      { field: "status", label: "合同状态", type: "string", required: false, defaultValue: "已生效",
        enumValues: ["草稿", "已生效", "执行中", "已完成", "已终止"] },
    ],
    aiPromptContext: "收入合同信息，包含合同编号、客户名称、项目编号、合同金额、签订日期、税率、合同状态等",
  },
  "expense-contracts": {
    module: "expense-contracts",
    moduleName: "支出合同",
    dependsOn: ["suppliers", "projects"],
    fields: [
      { field: "contractNo", label: "合同编号", type: "string", required: true },
      { field: "supplierName", label: "供应商名称", type: "lookup", required: true,
        lookup: { type: "supplier", prismaModel: "supplier", nameField: "name", idField: "id" } },
      { field: "projectSourceId", label: "项目编号", type: "lookup", required: false,
        lookup: { type: "project", prismaModel: "project", nameField: "projectCode", idField: "projectSourceId" } },
      { field: "signedDate", label: "签约日期", type: "date", required: false },
      { field: "totalAmount", label: "合同金额", type: "decimal", required: true },
      { field: "contractType", label: "合同类型", type: "string", required: false, defaultValue: "其他" },
      { field: "taxRate", label: "税率", type: "string", required: false },
      { field: "paymentTerms", label: "付款条款", type: "string", required: false },
      { field: "organizationName", label: "经营主体", type: "lookup", required: false,
        lookup: { type: "organization", prismaModel: "organization", nameField: "name", idField: "id" } },
      { field: "status", label: "合同状态", type: "string", required: false, defaultValue: "已生效" },
    ],
    aiPromptContext: "支出合同信息，包含合同编号、供应商名称、项目编号、合同金额、合同类型等",
  },
  invoices: {
    module: "invoices",
    moduleName: "发票",
    dependsOn: ["income-contracts", "expense-contracts", "projects"],
    fields: [
      { field: "invoiceNo", label: "发票号码", type: "string", required: true },
      { field: "invoiceCode", label: "发票代码", type: "string", required: false },
      { field: "invoiceType", label: "发票类型", type: "string", required: true,
        enumValues: ["增值税专用发票", "普通发票", "电子发票"] },
      { field: "invoiceCategory", label: "发票分类", type: "string", required: true,
        enumValues: ["销项", "进项"] },
      { field: "invoiceDate", label: "开票日期", type: "date", required: true },
      { field: "amount", label: "金额（不含税）", type: "decimal", required: true },
      { field: "taxRate", label: "税率", type: "decimal", required: true },
      { field: "taxAmount", label: "税额", type: "decimal", required: true },
      { field: "totalAmount", label: "价税合计", type: "decimal", required: true },
      { field: "sellerName", label: "销售方名称", type: "string", required: false },
      { field: "sellerTaxNo", label: "销售方税号", type: "string", required: false },
      { field: "buyerName", label: "购买方名称", type: "string", required: false },
      { field: "buyerTaxNo", label: "购买方税号", type: "string", required: false },
      { field: "projectSourceId", label: "项目编号", type: "lookup", required: false,
        lookup: { type: "project", prismaModel: "project", nameField: "projectCode", idField: "projectSourceId" } },
      { field: "sourceType", label: "来源类型", type: "string", required: true,
        enumValues: ["income_contract", "expense_contract"] },
      { field: "sourceContractNo", label: "来源合同编号", type: "lookup", required: false,
        lookup: { type: "contract", prismaModel: "income_contract", nameField: "contractNo", idField: "id" } },
    ],
    aiPromptContext: "发票信息，包含发票号码、开票日期、金额、税率、税额、价税合计、销售方、购买方等",
  },
  receivables: {
    module: "receivables",
    moduleName: "应收款",
    dependsOn: ["income-contracts", "projects"],
    fields: [
      { field: "sourceType", label: "来源类型", type: "string", required: true,
        defaultValue: "income_contract" },
      { field: "sourceContractNo", label: "来源合同编号", type: "lookup", required: true,
        lookup: { type: "contract", prismaModel: "income_contract", nameField: "contractNo", idField: "id" } },
      { field: "projectSourceId", label: "项目编号", type: "lookup", required: false,
        lookup: { type: "project", prismaModel: "project", nameField: "projectCode", idField: "projectSourceId" } },
      { field: "dueDate", label: "到期日", type: "date", required: true },
      { field: "amount", label: "应收金额", type: "decimal", required: true },
      { field: "paidAmount", label: "已收金额", type: "decimal", required: false, defaultValue: "0" },
      { field: "status", label: "状态", type: "string", required: false, defaultValue: "未收",
        enumValues: ["未收", "部分收", "已收"] },
      { field: "organizationName", label: "经营主体", type: "lookup", required: false,
        lookup: { type: "organization", prismaModel: "organization", nameField: "name", idField: "id" } },
    ],
    aiPromptContext: "应收款信息，包含来源合同、到期日、应收金额、已收金额等",
  },
  payables: {
    module: "payables",
    moduleName: "应付款",
    dependsOn: ["expense-contracts", "projects"],
    fields: [
      { field: "sourceType", label: "来源类型", type: "string", required: true,
        defaultValue: "expense_contract" },
      { field: "sourceContractNo", label: "来源合同编号", type: "lookup", required: true,
        lookup: { type: "contract", prismaModel: "expense_contract", nameField: "contractNo", idField: "id" } },
      { field: "projectSourceId", label: "项目编号", type: "lookup", required: false,
        lookup: { type: "project", prismaModel: "project", nameField: "projectCode", idField: "projectSourceId" } },
      { field: "dueDate", label: "到期日", type: "date", required: true },
      { field: "amount", label: "应付金额", type: "decimal", required: true },
      { field: "paidAmount", label: "已付金额", type: "decimal", required: false, defaultValue: "0" },
      { field: "status", label: "状态", type: "string", required: false, defaultValue: "未付",
        enumValues: ["未付", "部分付", "已付"] },
      { field: "organizationName", label: "经营主体", type: "lookup", required: false,
        lookup: { type: "organization", prismaModel: "organization", nameField: "name", idField: "id" } },
    ],
    aiPromptContext: "应付款信息，包含来源合同、到期日、应付金额、已付金额等",
  },
};

/** 获取所有已注册的模块 */
export function getRegisteredModules(): ImportModule[] {
  return Object.keys(MODULE_REGISTRY) as ImportModule[];
}

/** 根据模块名获取配置 */
export function getModuleConfig(module: ImportModule): ModuleImportConfig {
  return MODULE_REGISTRY[module];
}

/** 获取模块的依赖关系 */
export function getModuleDependencies(module: ImportModule): ImportModule[] {
  return MODULE_REGISTRY[module].dependsOn;
}

/** 获取目标字段列表（用于 AI 提示） */
export function getTargetFieldDescriptions(): string {
  const lines: string[] = [];
  for (const [key, config] of Object.entries(MODULE_REGISTRY)) {
    lines.push(`模块: ${config.moduleName} (${key})`);
    config.fields.forEach((f) => {
      lines.push(`  - ${f.field} (${f.label}, ${f.type}, ${f.required ? "必填" : "可选"})`);
    });
  }
  return lines.join("\n");
}
