/**
 * 客户属性（所有权归属）常量
 * 前身为"行业类型"，现改为按客户所有权属性分类
 */

/** 客户属性选项列表 */
export const OWNERSHIP_TYPE_OPTIONS = [
  { value: "国有", label: "国有" },
  { value: "民营", label: "民营" },
  { value: "外资", label: "外资" },
  { value: "政府或事业机构", label: "政府或事业机构" },
  { value: "其他", label: "其他" },
] as const;

/** 客户属性值类型 */
export type OwnershipType = (typeof OWNERSHIP_TYPE_OPTIONS)[number]["value"];

/** 客户属性 Badge 颜色映射 */
export const ownershipTypeColorMap: Record<OwnershipType, string> = {
  "国有": "ios-badge-blue",
  "民营": "ios-badge-green",
  "外资": "ios-badge-orange",
  "政府或事业机构": "ios-badge-purple",
  "其他": "ios-badge-gray",
};

/** 客户属性字段名（中文标签） */
export const OWNERSHIP_TYPE_LABEL = "客户属性";
