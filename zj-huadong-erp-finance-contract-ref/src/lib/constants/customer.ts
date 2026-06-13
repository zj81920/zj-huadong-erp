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
