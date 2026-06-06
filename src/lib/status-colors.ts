export const STATUS_ROW_COLORS: Record<string, string> = {
  // 通用审批状态
  "草稿":   "row-status-draft",
  "审批中": "row-status-pending",
  "已批准": "row-status-approved",
  "已驳回": "row-status-rejected",
  "已归档": "row-status-archived",
  "合同归档": "row-status-archived",
  "已生效": "row-status-archived",

  // 应收应付
  "未收":     "row-status-pending",
  "部分收款": "row-status-pending",
  "已收":     "row-status-approved",
  "逾期":     "row-status-overdue",
  "未付":     "row-status-pending",
  "部分付款": "row-status-pending",
  "已付":     "row-status-approved",

  // 供应商
  "当前有效": "row-status-approved",
  "已失效":   "row-status-rejected",

  // 报价
  "跟踪": "row-status-draft",
  "落地": "row-status-approved",
  "放弃": "row-status-rejected",

  // 项目
  "执行": "row-status-approved",
  "暂停": "row-status-pending",
  "关闭": "row-status-rejected",

  // 项目计划
  "未开始": "row-status-draft",
  "进行中": "row-status-pending",
  "已完成": "row-status-approved",

  // 借入/借出
  "未还清": "row-status-pending",
  "已还清": "row-status-approved",

  // 发票
  "已登记": "row-status-draft",

  // 工资发放状态
  "已支付": "row-status-approved",
  "已发放": "row-status-approved",
};

export function getRowStatusClass(status: string | null | undefined): string {
  return status ? (STATUS_ROW_COLORS[status] ?? "") : "";
}
