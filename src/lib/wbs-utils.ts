// ========== 类型定义 ==========

export interface ProgressData {
  plannedPct: number;
  actualPct: number;
}

export interface WbsNodeInput extends ProgressData {
  id: string;
  parentId: string | null;
  level: number;
  name: string;
  sortOrder: number;
  [key: string]: unknown;
}

export interface WbsTreeNode extends WbsNodeInput {
  children: WbsTreeNode[];
}

export type AIStatus = "ontrack" | "delayed" | "wait" | "done" | "none";

export interface StatusDetail {
  status: AIStatus;
  label: string;
  reason: string;
}

// ========== 新六态系统 ==========

export type TaskStatus = "aheadComplete" | "onTimeComplete" | "overdueComplete" | "ahead" | "delayed" | "normal" | "none";

export interface TaskStatusResult {
  status: TaskStatus;
  emoji: string;
  label: string;
  planPct: number;
}

/**
 * 纯函数：计算任务六态
 * 优先级 P1-P6，命中即返回
 */
export function computeTaskStatus(
  progress: number,
  planStart: Date | null,
  planEnd: Date | null,
  today: Date = new Date()
): TaskStatusResult {
  if (!planStart || !planEnd) {
    return { status: "none", emoji: "—", label: "无计划", planPct: 0 };
  }

  const planPct = calcPlanProgress(planStart, planEnd, today);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const planEndStart = new Date(planEnd.getFullYear(), planEnd.getMonth(), planEnd.getDate());

  // P1: 提前完成
  if (progress >= 100 && todayStart < planEndStart) {
    return { status: "aheadComplete", emoji: "🎉", label: "提前完成", planPct };
  }

  // P2: 按期完成
  if (progress >= 100 && todayStart.getTime() === planEndStart.getTime()) {
    return { status: "onTimeComplete", emoji: "🏁", label: "按期完成", planPct };
  }

  // P3: 超期完成
  if (progress >= 100) {
    return { status: "overdueComplete", emoji: "⚠️", label: "超期完成", planPct };
  }

  // P4: 提前
  if (progress > 0 && progress < 100) {
    const planStartStart = new Date(planStart.getFullYear(), planStart.getMonth(), planStart.getDate());
    if (todayStart < planStartStart || progress >= planPct) {
      return { status: "ahead", emoji: "🚀", label: "提前", planPct };
    }
  }

  // P5: 延误
  const planStartStart = new Date(planStart.getFullYear(), planStart.getMonth(), planStart.getDate());
  if (progress > 0 && progress < 100 && todayStart >= planStartStart && progress < planPct) {
    return { status: "delayed", emoji: "⚠️", label: "延误", planPct };
  }
  if (progress === 0 && todayStart > planStartStart) {
    return { status: "delayed", emoji: "⚠️", label: "延误", planPct };
  }

  // P6: 正常
  return { status: "normal", emoji: "✅", label: "正常", planPct };
}

/**
 * 上级节点状态汇总
 * 优先级: delayed > ahead > normal > done > none
 */
export function computeParentStatus(
  children: TaskStatusResult[]
): TaskStatusResult {
  if (children.length === 0) return { status: "none", emoji: "—", label: "无任务", planPct: 0 };

  const hasDelayed = children.some(c => c.status === "delayed");
  const hasAhead = children.some(c => c.status === "ahead");
  const hasNormal = children.some(c => c.status === "normal");
  const allDone = children.every(c =>
    c.status === "aheadComplete" || c.status === "onTimeComplete" || c.status === "overdueComplete"
  );

  if (hasDelayed) return { status: "delayed", emoji: "⚠️", label: "含延误", planPct: 0 };
  if (hasAhead) return { status: "ahead", emoji: "🚀", label: "进行中(提前)", planPct: 0 };
  if (hasNormal) return { status: "normal", emoji: "✅", label: "进行中", planPct: 0 };
  if (allDone) return { status: "onTimeComplete", emoji: "🏁", label: "已完成", planPct: 0 };
  return { status: "none", emoji: "—", label: "无进行中任务", planPct: 0 };
}

/** 进度聚合：取子任务 progress 平均值（向下取整） */
export function aggregateProgress(progressValues: number[]): number {
  if (progressValues.length === 0) return 0;
  return Math.floor(progressValues.reduce((s, v) => s + v, 0) / progressValues.length);
}

// ========== 工具函数 ==========

/** 计算计划应完成%：根据天数均匀分布 */
export function calcPlanProgress(
  planStart: Date,
  planEnd: Date,
  today: Date = new Date()
): number {
  const total = (planEnd.getTime() - planStart.getTime()) / (1000 * 3600 * 24);
  if (total <= 0) return 100;
  const elapsed = (today.getTime() - planStart.getTime()) / (1000 * 3600 * 24);
  if (elapsed <= 0) return 0;
  return Math.min(100, Math.round((elapsed / total) * 100));
}

/** 日期差（天数） */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 3600 * 24));
}

/**
 * AI 状态判断引擎 — 对单个四级任务做状态判断
 * 优先级：已完成 → 未按时开始 → 等待开始 → 进行中对比
 */
export function judgeTaskStatus(
  task: {
    planStart: string;
    planEnd: string;
    actualStart?: string;
    actualEnd?: string;
    pct?: number;
  },
  today: Date = new Date()
): StatusDetail {
  if (!task.planStart || !task.planEnd) {
    return { status: "none", label: "-", reason: "无计划时间" };
  }

  const pStart = new Date(task.planStart);
  const pEnd = new Date(task.planEnd);
  const aStart = task.actualStart ? new Date(task.actualStart) : null;
  const aEnd = task.actualEnd ? new Date(task.actualEnd) : null;
  const pct = task.pct ?? 0;

  // 场景1：已完成
  if (pct >= 100) {
    if (aEnd) {
      if (aEnd <= pEnd) {
        return { status: "done", label: "✓", reason: "按期完成" };
      } else {
        return { status: "delayed", label: "!", reason: "超期完成" };
      }
    }
    return { status: "done", label: "✓", reason: "已完成" };
  }

  // 场景2：未按时开始
  if (!aStart && pStart <= today) {
    const lag = daysBetween(pStart, today);
    return { status: "delayed", label: "!", reason: `未按时开始(已逾期${lag}天)` };
  }

  // 场景3：等待开始
  if (!aStart && pStart > today) {
    return { status: "wait", label: "-", reason: "等待开始" };
  }

  // 场景4：进行中
  if (aStart && pct < 100) {
    const planPct = calcPlanProgress(pStart, pEnd, today);
    if (planPct <= 0) {
      return { status: "ontrack", label: "✓", reason: "提前开始" };
    }
    if (pct >= planPct - 5) {
      return { status: "ontrack", label: "✓", reason: "按期" };
    } else {
      return { status: "delayed", label: "!", reason: "进度滞后" };
    }
  }

  return { status: "none", label: "-", reason: "" };
}

/** 对上级节点(1/2/3级)汇总子节点AI状态 */
export function judgeParentStatus(
  tasks: { planStart: string; planEnd: string; actualStart?: string; actualEnd?: string; pct?: number }[],
  today: Date = new Date()
): StatusDetail {
  if (tasks.length === 0) return { status: "none", label: "-", reason: "无任务" };

  let hasDelayed = false;
  let hasOntrack = false;
  let hasWait = false;
  let hasDone = false;

  for (const task of tasks) {
    const r = judgeTaskStatus(task, today);
    if (r.status === "delayed") hasDelayed = true;
    if (r.status === "ontrack") hasOntrack = true;
    if (r.status === "wait") hasWait = true;
    if (r.status === "done") hasDone = true;
  }

  if (hasDelayed) return { status: "delayed", label: "!", reason: "含延误子任务" };
  if (hasOntrack) return { status: "ontrack", label: "✓", reason: "进行中，按期" };
  if (hasWait) return { status: "wait", label: "-", reason: "等待开始" };
  if (hasDone) return { status: "done", label: "✓", reason: "已完成" };
  return { status: "none", label: "-", reason: "无进行中任务" };
}

/** 进度汇总：取子节点平均值 */
export function summarizeProgress(children: ProgressData[]) {
  if (children.length === 0) {
    return { plannedPct: 0, actualPct: 0 };
  }
  const totalPlanned = children.reduce((s, c) => s + c.plannedPct, 0);
  const totalActual = children.reduce((s, c) => s + c.actualPct, 0);
  const plannedPct = Math.floor(totalPlanned / children.length);
  const actualPct = Math.floor(totalActual / children.length);
  return { plannedPct, actualPct };
}

/** 构建树形结构 */
export function buildWbsTree<T extends WbsNodeInput>(nodes: T[]): WbsTreeNode[] {
  const map = new Map<string, WbsTreeNode>();
  const roots: WbsTreeNode[] = [];
  for (const node of nodes) {
    map.set(node.id, { ...node, children: [] } as unknown as WbsTreeNode);
  }
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortChildren = (ns: WbsTreeNode[]) => {
    ns.sort((a, b) => a.sortOrder - b.sortOrder);
    ns.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);
  return roots;
}
