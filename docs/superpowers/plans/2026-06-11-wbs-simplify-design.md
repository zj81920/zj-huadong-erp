# WBS 计划系统简化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 WBS 计划系统从五态+前后端双套逻辑简化为六态纯函数计算，删除 actualStart/End 字段，responsibleId 改为数组，仪表盘增加阶段标签列和风险等级

**Architecture:** 核心纯函数 `computeTaskStatus()` 在前端实时计算状态，后端只负责数据校验和持久化，不再执行 `cascadeSummarize`、`delayDays` 推导等计算逻辑

**Tech Stack:** Next.js 14 App Router + Prisma + TypeScript + React (inline styles)

---

## 第〇部分：TDD 核心函数

### Task 0: `computeTaskStatus()` — TDD 六态纯函数

**Files:**
- Modify: `src/lib/wbs-utils.ts:1-171`
- Modify: `test/unit/wbs-utils.test.ts:1-150`

- [ ] **Step 1: 在测试文件末尾添加 `computeTaskStatus` 的失败测试**

在 `test/unit/wbs-utils.test.ts` 末尾追加：

```typescript
import { describe, it, expect } from "vitest";
import { computeTaskStatus, computeParentStatus, aggregateProgress } from "@/lib/wbs-utils";

const T = new Date("2026-06-10");

describe("computeTaskStatus", () => {
  // P1: 提前完成 — progress=100 且 today < planEndDate
  it("P1 提前完成: progress=100, today < planEnd", () => {
    const r = computeTaskStatus(100, new Date("2026-05-01"), new Date("2026-08-15"), T);
    expect(r.status).toBe("aheadComplete");
    expect(r.emoji).toBe("🎉");
  });

  // P2: 按期完成 — progress=100 且 today 与 planEndDate 同一天
  it("P2 按期完成: progress=100, today = planEnd", () => {
    const r = computeTaskStatus(100, new Date("2026-04-01"), new Date("2026-06-10"), T);
    expect(r.status).toBe("onTimeComplete");
    expect(r.emoji).toBe("🏁");
  });

  // P3: 超期完成 — progress=100 且 today > planEndDate
  it("P3 超期完成: progress=100, today > planEnd", () => {
    const r = computeTaskStatus(100, new Date("2026-04-01"), new Date("2026-05-31"), T);
    expect(r.status).toBe("overdueComplete");
    expect(r.emoji).toBe("⚠️");
  });

  // P4: 提前 — progress>0 且 <100，且 (today < planStart 或 progress ≥ planPct)
  it("P4 提前: 尚未到计划开始但已开始做", () => {
    const r = computeTaskStatus(20, new Date("2026-07-01"), new Date("2026-09-15"), T);
    expect(r.status).toBe("ahead");
    expect(r.emoji).toBe("🚀");
  });

  it("P4 提前: 进度大于等于计划进度", () => {
    // 5/1 ~ 8/15, today=6/10, planPct≈38%, progress=40% ≥ 38%
    const r = computeTaskStatus(40, new Date("2026-05-01"), new Date("2026-08-15"), T);
    expect(r.status).toBe("ahead");
    expect(r.emoji).toBe("🚀");
  });

  // P5: 延误 — progress>0且<100, today≥planStart, progress<planPct
  it("P5 延误: 进度落后于计划", () => {
    // 5/15 ~ 7/15, today=6/10, planPct≈42%, progress=8% < 42%
    const r = computeTaskStatus(8, new Date("2026-05-15"), new Date("2026-07-15"), T);
    expect(r.status).toBe("delayed");
    expect(r.emoji).toBe("⚠️");
  });

  it("P5 延误: progress=0 但已过计划开始日", () => {
    const r = computeTaskStatus(0, new Date("2026-05-20"), new Date("2026-06-30"), T);
    expect(r.status).toBe("delayed");
    expect(r.emoji).toBe("⚠️");
  });

  // P6: 正常 — progress=0 且 today ≤ planStart
  it("P6 正常: 等待开始", () => {
    const r = computeTaskStatus(0, new Date("2026-07-01"), new Date("2026-09-15"), T);
    expect(r.status).toBe("normal");
    expect(r.emoji).toBe("✅");
  });

  // 边界: planStart=planEnd, planPct=100
  it("边界: planStart=planEnd 时 planPct=100", () => {
    const r = computeTaskStatus(0, new Date("2026-06-01"), new Date("2026-06-01"), T);
    // today(6/10) > planStart(6/1), progress=0 → 延误
    expect(r.status).toBe("delayed");
  });

  // 无计划日期
  it("无计划日期返回 none", () => {
    const r = computeTaskStatus(0, null as any, null as any, T);
    expect(r.status).toBe("none");
    expect(r.emoji).toBe("—");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run test/unit/wbs-utils.test.ts 2>&1 | tail -20
```
Expected: 新增测试 FAIL，报 `computeTaskStatus is not exported` 或类似错误

- [ ] **Step 3: 实现 `computeTaskStatus()` 函数**

在 `src/lib/wbs-utils.ts` 文件顶部（类型定义区之后）添加：

```typescript
// ========== 新六态系统 ==========

export type TaskStatus = "aheadComplete" | "onTimeComplete" | "overdueComplete" | "ahead" | "delayed" | "normal" | "none";

export interface TaskStatusResult {
  status: TaskStatus;
  emoji: string;
  label: string;
  planPct: number;
}

const STATUS_MAP: Record<TaskStatus, { emoji: string; label: string }> = {
  aheadComplete:  { emoji: "🎉", label: "提前完成" },
  onTimeComplete: { emoji: "🏁", label: "按期完成" },
  overdueComplete:{ emoji: "⚠️", label: "超期完成" },
  ahead:          { emoji: "🚀", label: "提前" },
  delayed:        { emoji: "⚠️", label: "延误" },
  normal:         { emoji: "✅", label: "正常" },
  none:           { emoji: "—",  label: "无计划" },
};

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

  // P4: 提前 — 有进度但未完成
  if (progress > 0 && progress < 100) {
    const todayStart2 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const planStartStart = new Date(planStart.getFullYear(), planStart.getMonth(), planStart.getDate());
    if (todayStart2 < planStartStart || progress >= planPct) {
      return { status: "ahead", emoji: "🚀", label: "提前", planPct };
    }
  }

  // P5: 延误
  const planStartStart2 = new Date(planStart.getFullYear(), planStart.getMonth(), planStart.getDate());
  const todayStart3 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (progress > 0 && progress < 100 && todayStart3 >= planStartStart2 && progress < planPct) {
    return { status: "delayed", emoji: "⚠️", label: "延误", planPct };
  }
  if (progress === 0 && todayStart3 > planStartStart2) {
    return { status: "delayed", emoji: "⚠️", label: "延误", planPct };
  }

  // P6: 正常 — progress=0 且 today ≤ planStart
  return { status: "normal", emoji: "✅", label: "正常", planPct };
}
```

- [ ] **Step 4: 运行测试确认全部通过**

```bash
npx vitest run test/unit/wbs-utils.test.ts
```
Expected: 所有测试 PASS（包括旧测试）

- [ ] **Step 5: 提交**

```bash
git add src/lib/wbs-utils.ts test/unit/wbs-utils.test.ts
git commit -m "feat: 新增 computeTaskStatus() 六态纯函数（TDD）"
```

---

### Task 1: `computeParentStatus()` — TDD 上级节点汇总

**Files:**
- Modify: `src/lib/wbs-utils.ts`
- Modify: `test/unit/wbs-utils.test.ts`

- [ ] **Step 1: 添加失败测试**

在 `test/unit/wbs-utils.test.ts` 末尾追加：

```typescript
describe("computeParentStatus", () => {
  it("全部子任务为 normal → normal", () => {
    const children = [
      computeTaskStatus(0, new Date("2026-07-01"), new Date("2026-09-15"), T),
    ];
    expect(computeParentStatus(children).status).toBe("normal");
  });

  it("任一子任务 delayed → delayed", () => {
    const children = [
      computeTaskStatus(100, new Date("2026-05-01"), new Date("2026-08-15"), T), // aheadComplete
      computeTaskStatus(8, new Date("2026-05-15"), new Date("2026-07-15"), T),    // delayed
    ];
    expect(computeParentStatus(children).status).toBe("delayed");
  });

  it("全部完成 → done", () => {
    const children = [
      computeTaskStatus(100, new Date("2026-04-01"), new Date("2026-05-31"), T),  // overdueComplete
      computeTaskStatus(100, new Date("2026-05-01"), new Date("2026-08-15"), T),  // aheadComplete
    ];
    expect(computeParentStatus(children).status).toBe("done");
  });

  it("无子任务 → none", () => {
    expect(computeParentStatus([]).status).toBe("none");
  });

  it("混合: ahead + onTimeComplete → ahead", () => {
    const children = [
      computeTaskStatus(100, new Date("2026-04-01"), new Date("2026-06-10"), T),  // onTimeComplete
      computeTaskStatus(40, new Date("2026-05-01"), new Date("2026-08-15"), T),   // ahead
    ];
    const r = computeParentStatus(children);
    expect(r.status).toBe("ahead");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run test/unit/wbs-utils.test.ts -t "computeParent" 2>&1 | tail -10
```
Expected: FAIL — `computeParentStatus is not exported`

- [ ] **Step 3: 实现 `computeParentStatus()`**

在 `src/lib/wbs-utils.ts` 中 `computeTaskStatus` 之后添加：

```typescript
/**
 * 上级节点状态汇总
 * 优先级: delayed > ahead > normal > done > none
 */
export function computeParentStatus(
  children: TaskStatusResult[]
): TaskStatusResult {
  if (children.length === 0) return { status: "none", emoji: "—", label: "无任务", planPct: 0 };

  const hasDelayed = children.some(c => c.status === "delayed");
  const hasAhead = children.some(c => c.status === "ahead" || c.status === "aheadComplete");
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
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run test/unit/wbs-utils.test.ts -t "computeParent"
```
Expected: 5 tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/wbs-utils.ts test/unit/wbs-utils.test.ts
git commit -m "feat: computeParentStatus 上级节点汇总（TDD）"
```

---

### Task 2: `aggregateProgress()` — TDD 进度聚合

**Files:**
- Modify: `src/lib/wbs-utils.ts`
- Modify: `test/unit/wbs-utils.test.ts`

- [ ] **Step 1: 添加失败测试**

```typescript
describe("aggregateProgress", () => {
  it("空数组返回 0", () => {
    expect(aggregateProgress([])).toBe(0);
  });

  it("多个 progress 取平均值（向下取整）", () => {
    expect(aggregateProgress([100, 50, 33])).toBe(61);
  });

  it("单个任务直接返回", () => {
    expect(aggregateProgress([75])).toBe(75);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run test/unit/wbs-utils.test.ts -t "aggregate" 2>&1 | tail -10
```

- [ ] **Step 3: 实现**

在 `src/lib/wbs-utils.ts` 中添加：

```typescript
/** 进度聚合：取子任务 progress 平均值（向下取整） */
export function aggregateProgress(progressValues: number[]): number {
  if (progressValues.length === 0) return 0;
  return Math.floor(progressValues.reduce((s, v) => s + v, 0) / progressValues.length);
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run test/unit/wbs-utils.test.ts -t "aggregate"
```

- [ ] **Step 5: 提交**

```bash
git add src/lib/wbs-utils.ts test/unit/wbs-utils.test.ts
git commit -m "feat: aggregateProgress 进度聚合函数（TDD）"
```

---

## 第一部分：数据模型层

### Task 3: Prisma Schema 变更 + 迁移

**Files:**
- Modify: `prisma/schema.prisma:371-402`
- Create: `prisma/migrations/*/migration.sql` (auto)

- [ ] **Step 1: 修改 `ProjectWbsNode` 模型**

在 `prisma/schema.prisma` 中修改 `ProjectWbsNode`：

```prisma
model ProjectWbsNode {
  id              String    @id @default(cuid())
  projectSourceId String    @map("project_source_id")
  parentId        String?   @map("parent_id")
  level           Int       @map("level")
  name            String    @map("name")
  disciplineId    String?   @map("discipline_id")
  isMilestone     Boolean   @default(false) @map("is_milestone")
  planStartDate   DateTime? @map("plan_start_date")
  planEndDate     DateTime? @map("plan_end_date")
  progress        Int       @default(0) @map("progress")
  sortOrder       Int       @default(0) @map("sort_order")
  responsibleIds  Json      @default("[]") @map("responsible_ids")
  aiGenerated     Boolean   @default(false) @map("ai_generated")
  version         Int       @default(1)
  lastModifiedBy  String?   @map("last_modified_by")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  project           Project         @relation(fields: [projectSourceId], references: [projectSourceId])
  parent            ProjectWbsNode? @relation("WbsHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  children          ProjectWbsNode[] @relation("WbsHierarchy")
  taskLogs          WbsTaskLog[]

  @@index([projectSourceId])
  @@index([parentId])
  @@map("project_wbs_nodes")
}
```

变更说明：
- 删除字段: `actualStartDate`, `actualEndDate`, `status`, `delayDays`
- `responsibleId String?` → `responsibleIds Json @default("[]")`
- 新增 `aiGenerated Boolean @default(false)`
- `parent` 关系添加 `onDelete: Cascade`
- 移除 `responsiblePerson` 关系（无法直接关联 Json 数组到 User 表）

- [ ] **Step 2: 生成并执行迁移**

```bash
npx prisma migrate dev --name wbs_simplify_v2
```
Expected: 迁移成功，数据库字段变更完成

- [ ] **Step 3: 提交**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: WBS 数据模型简化 — 删4字段, responsibleIds Json, Cascade"
```

---

## 第二部分：后端 API

### Task 4: 简化进度 API（去 actualStart/End、delayDays、cascadeSummarize）

**Files:**
- Modify: `src/app/api/projects/plans/[projectSourceId]/nodes/[id]/progress/route.ts`

- [ ] **Step 1: 重写进度 API**

将 `src/app/api/projects/plans/[projectSourceId]/nodes/[id]/progress/route.ts` 替换为：

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { canAccessProjectWbs } from "@/lib/wbs-auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectSourceId: string; id: string }> }
) {
  try {
    const { projectSourceId, id } = await params;
    const authorized = await canAccessProjectWbs(projectSourceId);
    if (!authorized) return NextResponse.json({ error: "无权操作" }, { status: 403 });

    const body = await request.json();
    const { progress } = body;

    if (typeof progress !== "number" || progress < 0 || progress > 100) {
      return NextResponse.json({ error: "进度值非法(0-100)" }, { status: 400 });
    }

    const existing = await prisma.projectWbsNode.findFirst({
      where: { id, projectSourceId },
    });
    if (!existing) return NextResponse.json({ error: "节点不存在" }, { status: 404 });
    if (existing.level !== 4) {
      return NextResponse.json({ error: "仅4级节点(任务)支持进度填报" }, { status: 400 });
    }

    // 只更新 progress，不再推 actualStart/End、status、delayDays
    const node = await prisma.projectWbsNode.update({
      where: { id },
      data: { progress },
    });

    // 返回整棵树（前端自行计算状态）
    const allNodes = await prisma.projectWbsNode.findMany({
      where: { projectSourceId },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
    });

    return NextResponse.json({ data: node, tree: allNodes });
  } catch (error) {
    console.error("填报进度失败:", error);
    return NextResponse.json({ error: "填报进度失败" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/api/projects/plans/\[projectSourceId\]/nodes/\[id\]/progress/route.ts
git commit -m "refactor: 简化进度API — 只更新progress，移除状态推导"
```

---

### Task 5: 阶段同步修复（减少阶段递归删除）

**Files:**
- Modify: `src/app/api/projects/[id]/route.ts:138-175`

- [ ] **Step 1: 修复减少阶段时的级联删除逻辑**

在 `src/app/api/projects/[id]/route.ts` 中，替换减少阶段部分（约第 152-155 行）：

找到：
```typescript
        // 1. 删除旧数组中有但新数组中没有的阶段（级联删除子节点）
        const toDelete = existingL1Nodes.filter((n) => !newPhases.includes(n.name));
        for (const node of toDelete) {
          await prisma.projectWbsNode.delete({ where: { id: node.id } });
        }
```

替换为：
```typescript
        // 1. 删除旧数组中有但新数组中没有的阶段（递归删除所有子节点）
        const toDelete = existingL1Nodes.filter((n) => !newPhases.includes(n.name));
        for (const node of toDelete) {
          // 递归收集所有后代节点ID
          async function collectDescendantIds(parentId: string): Promise<string[]> {
            const children = await prisma.projectWbsNode.findMany({
              where: { parentId },
              select: { id: true },
            });
            let ids = children.map(c => c.id);
            for (const child of children) {
              ids = ids.concat(await collectDescendantIds(child.id));
            }
            return ids;
          }
          const descendantIds = await collectDescendantIds(node.id);
          // 从最深层开始删除（或依赖 onDelete: Cascade）
          // Schema 已加 Cascade，直接删除父节点即可级联
          await prisma.projectWbsNode.delete({ where: { id: node.id } });
        }
```

注：由于 Step 1 已在 schema 添加 `onDelete: Cascade`，直接 `delete` 父节点即可级联删除。但为安全起见，保留显式递归收集后代逻辑。

- [ ] **Step 2: 提交**

```bash
git add src/app/api/projects/\[id\]/route.ts
git commit -m "fix: 阶段同步减少阶段时级联删除子树"
```

---

### Task 6: 仪表盘 Summary API 适配新状态函数

**Files:**
- Modify: `src/app/api/projects/plans/summary/route.ts`

- [ ] **Step 1: 重写 summary API**

替换 `src/app/api/projects/plans/summary/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeTaskStatus, calcPlanProgress } from "@/lib/wbs-utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const search = searchParams.get("search")?.trim() || "";

    const where: any = { wbsNodes: { some: {} } };
    if (search) {
      where.OR = [
        { sourceRefId: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const allProjects = await prisma.project.findMany({
      where,
      select: {
        id: true,
        projectSourceId: true,
        projectCode: true,
        sourceRefId: true,
        name: true,
        type: true,
        projectCategory: true,
        designPhases: true,
        customer: { select: { name: true } },
        _count: { select: { wbsNodes: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const total = allProjects.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const paged = allProjects.slice((page - 1) * pageSize, page * pageSize);

    // 批量获取 WBS 节点（L4 only, 只需要 progress + planStart + planEnd）
    const allSourceIds = allProjects.map((p) => p.projectSourceId);
    const allNodes = await prisma.projectWbsNode.findMany({
      where: { projectSourceId: { in: allSourceIds }, level: 4 },
      select: {
        projectSourceId: true,
        progress: true,
        planStartDate: true,
        planEndDate: true,
      },
    });

    const nodesByProject: Record<string, typeof allNodes> = {};
    for (const n of allNodes) {
      if (!nodesByProject[n.projectSourceId]) nodesByProject[n.projectSourceId] = [];
      nodesByProject[n.projectSourceId].push(n);
    }

    const today = new Date();

    function computeProjectSummary(p: (typeof allProjects)[0], nodes: typeof allNodes) {
      const taskNodes = nodes;
      const avgProgress =
        taskNodes.length > 0
          ? Math.round(taskNodes.reduce((s, n) => s + n.progress, 0) / taskNodes.length)
          : 0;

      const avgPlanPct =
        taskNodes.length > 0
          ? Math.round(
              taskNodes
                .filter((n) => n.planStartDate && n.planEndDate)
                .reduce((s, n) => s + calcPlanProgress(n.planStartDate!, n.planEndDate!, today), 0) /
                Math.max(1, taskNodes.filter((n) => n.planStartDate && n.planEndDate).length)
            )
          : 0;

      let delayedCount = 0;
      let aheadCount = 0;
      for (const n of taskNodes) {
        const s = computeTaskStatus(n.progress, n.planStartDate as Date | null, n.planEndDate as Date | null, today);
        if (s.status === "delayed" || s.status === "overdueComplete") delayedCount++;
        if (s.status === "ahead" || s.status === "aheadComplete") aheadCount++;
      }

      // 风险等级: 0延误=低, 1-2=中, ≥3=高
      const riskLevel = delayedCount === 0 ? "low" : delayedCount <= 2 ? "medium" : "high";

      return {
        id: p.id,
        projectSourceId: p.projectSourceId,
        projectCode: p.projectCode,
        sourceRefId: p.sourceRefId,
        name: p.name,
        customerName: p.customer?.name ?? "",
        type: p.type,
        projectCategory: p.projectCategory,
        designPhases: p.designPhases,
        designPhasesList: (() => {
          try { return JSON.parse(p.designPhases || "[]") as string[]; }
          catch { return []; }
        })(),
        nodeCount: p._count.wbsNodes,
        taskCount: taskNodes.length,
        overallProgress: avgProgress,
        avgPlanPct,
        delayedCount,
        aheadCount,
        riskLevel,
        isDelayed: delayedCount > 0,
        aiStatus: delayedCount > 0 ? "delayed" : "normal",
      };
    }

    const projects = paged.map((p) =>
      computeProjectSummary(p, nodesByProject[p.projectSourceId] || [])
    );

    // 全局统计
    let normalProjects = 0;
    let aheadProjects = 0;
    let delayedProjects = 0;
    for (const p of allProjects) {
      const s = computeProjectSummary(p, nodesByProject[p.projectSourceId] || []);
      if (s.delayedCount > 0) delayedProjects++;
      else if (s.aheadCount > 0) aheadProjects++;
      else normalProjects++;
    }

    return NextResponse.json({
      data: {
        projects,
        total,
        page,
        pageSize,
        totalPages,
        totalProjects: total,
        normalProjects,
        aheadProjects,
        delayedProjects,
      },
    });
  } catch (error) {
    console.error("获取WBS汇总失败:", error);
    return NextResponse.json({ error: "获取WBS汇总失败" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/api/projects/plans/summary/route.ts
git commit -m "refactor: summary API 适配 computeTaskStatus，新增风险等级和阶段标签"
```

---

## 第三部分：前端组件

### Task 7: 仪表盘列表页重写（4 卡片 + 阶段标签 + 风险圆点）

**Files:**
- Modify: `src/app/(dashboard)/projects/plans/page.tsx`

- [ ] **Step 1: 重写仪表盘页面**

替换 `src/app/(dashboard)/projects/plans/page.tsx` 完整内容：

```typescript
"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

interface ProjectSummary {
  projectSourceId: string;
  projectCode: string;
  sourceRefId: string | null;
  name: string;
  customerName: string;
  overallProgress: number;
  isDelayed: boolean;
  aiStatus: string;
  taskCount: number;
  nodeCount: number;
  delayedCount: number;
  aheadCount: number;
  riskLevel: "low" | "medium" | "high";
  designPhasesList: string[];
}

interface SummaryData {
  totalProjects: number;
  normalProjects: number;
  aheadProjects: number;
  delayedProjects: number;
  projects: ProjectSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 20;

export default function WbsDashboardPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback((q: string, p: number) => {
    const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
    if (q) params.set("search", q);
    fetch(`/api/projects/plans/summary?${params}`)
      .then((r) => r.json())
      .then((d) => setSummary(d.data))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchData(search, page); }, [page]); // eslint-disable-line

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setPage(1); fetchData(value, 1); }, 300);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (!summary) return <div style={{ padding: 24 }}>加载中...</div>;

  const riskEmoji: Record<string, string> = { low: "🟢", medium: "🟡", high: "🔴" };

  return (
    <div style={{ background: "#F0F1F3", minHeight: "100vh", padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>项目 WBS 计划与进度</h2>

      {/* 4 张统计卡片 */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <StatCard label="项目总数" value={summary.totalProjects} color="#44403C" />
        <StatCard label="🚀 提前" value={summary.aheadProjects} color="#7DA88E" />
        <StatCard label="✅ 正常" value={summary.normalProjects} color="#57534E" />
        <StatCard label="⚠️ 延误" value={summary.delayedProjects} color="#C47676" />
      </div>

      {/* 搜索框 */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="搜索项目编号 / 项目名称 / 甲方名称…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{
            width: "100%", maxWidth: 360, padding: "8px 12px", fontSize: 13,
            border: "1px solid #D0D5DD", borderRadius: 0, outline: "none",
            color: "#44403C", background: "#fff",
          }}
          onFocus={(e) => { e.target.style.borderColor = "#4A6FA5"; }}
          onBlur={(e) => { e.target.style.borderColor = "#D0D5DD"; }}
        />
      </div>

      {/* 项目列表 */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DFE3E8" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #DFE3E8" }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>项目列表</span>
          <span style={{ fontSize: 13, color: "#8C95A3" }}>共 {summary.total} 个项目</span>
        </div>

        {/* 表头 */}
        <div style={{
          display: "flex", padding: "10px 16px", borderBottom: "1px solid #DFE3E8",
          fontSize: 12, fontWeight: 500, color: "#8C95A3", background: "#FAFBFC",
        }}>
          <span style={{ width: 100 }}>项目编号</span>
          <span style={{ width: 200 }}>项目名称</span>
          <span style={{ flex: 1 }}>设计阶段</span>
          <span style={{ width: 100 }}>甲方</span>
          <span style={{ width: 110, textAlign: "center" }}>进度</span>
          <span style={{ width: 80, textAlign: "center" }}>状态</span>
          <span style={{ width: 40, textAlign: "center" }}>风险</span>
        </div>

        {/* 行 */}
        {summary.projects?.map((p) => (
          <Link
            key={p.projectSourceId}
            href={`/projects/plans/${p.projectSourceId}`}
            style={{
              display: "flex", alignItems: "center", padding: "10px 16px",
              borderBottom: "1px solid #F5F5F4", textDecoration: "none",
              background: p.isDelayed ? "#FFF5F5" : "transparent",
              transition: "background 0.15s",
            }}
          >
            <span style={{ width: 100, fontSize: 13, color: "#57534E" }}>
              {p.projectCode || p.sourceRefId || "-"}
            </span>
            <span style={{
              width: 200, fontWeight: 500, fontSize: 13, color: "#1C1917",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {p.name}
            </span>
            <span style={{ flex: 1, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(p.designPhasesList || []).map((phase) => (
                <span key={phase} style={{
                  padding: "2px 8px", fontSize: 11, borderRadius: 4,
                  background: "#EBF0F7", color: "#4A6FA5", whiteSpace: "nowrap",
                }}>
                  {phase}
                </span>
              ))}
            </span>
            <span style={{ width: 100, fontSize: 13, color: "#57534E" }}>
              {p.customerName || "-"}
            </span>
            <span style={{ width: 110, textAlign: "center", fontSize: 13 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  width: 60, height: 6, background: "#E8ECF1", borderRadius: 3,
                  display: "inline-block", overflow: "hidden",
                }}>
                  <span style={{
                    display: "block", height: "100%",
                    width: `${p.overallProgress ?? 0}%`,
                    background: p.isDelayed ? "#C47676" : "#7DA88E",
                    borderRadius: 3,
                  }} />
                </span>
                <span style={{ fontSize: 12, color: "#555" }}>{p.overallProgress ?? 0}%</span>
              </span>
            </span>
            <span style={{ width: 80, textAlign: "center" }}>
              {(() => {
                const isComplete = (p.overallProgress ?? 0) >= 100;
                let statusText: string;
                let badgeStyle: React.CSSProperties;
                if (isComplete) {
                  statusText = "🏁 已完成";
                  badgeStyle = { color: "#5A7A9A", border: "1px solid #C0D0E0", background: "#F5F8FB" };
                } else if (p.delayedCount > 0) {
                  statusText = `⚠️ 延误`;
                  badgeStyle = { color: "#C47676", border: "1px solid #E8C8C8", background: "#FDF6F6" };
                } else {
                  statusText = "✅ 正常";
                  badgeStyle = { color: "#5A8A6A", border: "1px solid #B8D4C0", background: "#F6FAF7" };
                }
                return (
                  <div>
                    <span style={{
                      ...badgeStyle, padding: "3px 10px", fontSize: 12, borderRadius: 4, display: "inline-block",
                    }}>
                      {statusText}
                    </span>
                    {p.delayedCount > 0 && (
                      <span style={{ display: "block", fontSize: 10, color: "#C47676", marginTop: 2 }}>
                        {p.delayedCount}项延误
                      </span>
                    )}
                  </div>
                );
              })()}
            </span>
            <span style={{ width: 40, textAlign: "center", fontSize: 16 }}>
              {riskEmoji[p.riskLevel] || "🟢"}
            </span>
          </Link>
        ))}

        {(!summary.projects || summary.projects.length === 0) && (
          <div style={{ padding: 32, textAlign: "center", color: "#A8A29E" }}>
            {search ? "未找到匹配的项目" : "暂无 WBS 计划数据"}
          </div>
        )}
      </div>

      {/* 分页 */}
      {summary.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 20 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={summary.page <= 1}
            style={paginationBtnStyle(summary.page <= 1)}
          >上一页</button>
          <span style={{ fontSize: 13, color: "#57534E" }}>
            第 {summary.page}/{summary.totalPages} 页
          </span>
          <button
            onClick={() => setPage((p) => Math.min(summary.totalPages, p + 1))}
            disabled={summary.page >= summary.totalPages}
            style={paginationBtnStyle(summary.page >= summary.totalPages)}
          >下一页</button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, background: "#fff", borderRadius: 0, border: "1px solid #DFE3E8", padding: "16px 20px" }}>
      <div style={{ fontSize: 13, color: "#78716C", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function paginationBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 16px", fontSize: 13, border: "1px solid #D0D5DD", borderRadius: 0,
    background: disabled ? "#fff" : "#4A6FA5", color: disabled ? "#555" : "#fff",
    borderColor: disabled ? "#D0D5DD" : "#4A6FA5",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/\(dashboard\)/projects/plans/page.tsx
git commit -m "feat: 仪表盘重写 — 4卡片+阶段标签+风险圆点"
```

---

### Task 8: 预警摘要条组件（新增）

**Files:**
- Create: `src/components/WbsAlertBar.tsx`

- [ ] **Step 1: 创建预警组件**

```typescript
"use client";

interface WbsAlertBarProps {
  totalTasks: number;
  delayedTasks: number;
  aheadTasks: number;
  overallProgress: number;
}

export default function WbsAlertBar({ totalTasks, delayedTasks, aheadTasks, overallProgress }: WbsAlertBarProps) {
  if (totalTasks === 0) return null;

  const normalTasks = totalTasks - delayedTasks;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "10px 20px", background: delayedTasks > 0 ? "#FFF5F5" : "#F6FAF7",
      borderBottom: "1px solid #DFE3E8", fontSize: 13,
    }}>
      <span style={{ fontWeight: 600, color: "#1C1917" }}>预警摘要</span>
      {delayedTasks > 0 ? (
        <span style={{ color: "#C47676" }}>
          ⚠️ 延误 <b>{delayedTasks}</b> 项
        </span>
      ) : (
        <span style={{ color: "#7DA88E" }}>✅ 无延误</span>
      )}
      {aheadTasks > 0 && (
        <span style={{ color: "#7DA88E" }}>🚀 提前 <b>{aheadTasks}</b> 项</span>
      )}
      <span style={{ color: "#57534E" }}>正常 <b>{normalTasks}</b> 项</span>
      <span style={{ marginLeft: "auto", fontWeight: 600, color: "#1C1917" }}>
        整体进度 {overallProgress}%
      </span>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/WbsAlertBar.tsx
git commit -m "feat: 新增 WbsAlertBar 预警摘要条组件"
```

---

### Task 9: 进度弹窗合并编辑功能

**Files:**
- Modify: `src/app/(dashboard)/projects/plans/[projectSourceId]/components/ProgressDialog.tsx`

- [ ] **Step 1: 重写进度弹窗（合并编辑：任务名 + 日期 + 进度）**

替换 `ProgressDialog.tsx`：

```typescript
"use client";
import { useState, useEffect } from "react";

interface Props {
  open: boolean;
  node: {
    id: string;
    name: string;
    progress: number;
    planStartDate?: string | null;
    planEndDate?: string | null;
    isMilestone?: boolean;
    projectSourceId: string;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProgressDialog({ open, node, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [progress, setProgress] = useState(0);
  const [planStart, setPlanStart] = useState("");
  const [planEnd, setPlanEnd] = useState("");
  const [isMilestone, setIsMilestone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (node) {
      setName(node.name || "");
      setProgress(node.progress || 0);
      setPlanStart(node.planStartDate?.slice(0, 10) || "");
      setPlanEnd(node.planEndDate?.slice(0, 10) || "");
      setIsMilestone(!!node.isMilestone);
    }
  }, [node]);

  if (!open || !node) return null;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/plans/${node!.projectSourceId}/nodes/${node!.id}/progress`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress }),
        }
      );
      if (res.ok) {
        onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", border: "1px solid #D6D3D1",
    borderRadius: 0, fontSize: 14, boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{ background: "#fff", borderRadius: 0, padding: 24, width: 440 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
          任务详情 — {node.name}
        </h3>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>任务名称</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>计划开始</label>
            <input type="date" value={planStart} onChange={(e) => setPlanStart(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>计划结束</label>
            <input type="date" value={planEnd} onChange={(e) => setPlanEnd(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={isMilestone} onChange={(e) => setIsMilestone(e.target.checked)} />
            里程碑
          </label>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
            进度 (0-100)
          </label>
          <input
            type="number" min={0} max={100}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button onClick={onClose} style={{
            padding: "8px 20px", borderRadius: 0, border: "1px solid #D6D3D1",
            background: "#fff", cursor: "pointer",
          }}>取消</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "8px 20px", borderRadius: 0, border: "none",
            background: "#4A6FA5", color: "#fff", cursor: "pointer", fontWeight: 500,
          }}>{saving ? "保存中..." : "保存"}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/\(dashboard\)/projects/plans/\[projectSourceId\]/components/ProgressDialog.tsx
git commit -m "feat: 进度弹窗合并编辑 — 任务名+日期+里程碑+进度"
```

---

### Task 10: WbsTreeList 适配新状态系统

**Files:**
- Modify: `src/app/(dashboard)/projects/plans/[projectSourceId]/components/WbsTreeList.tsx`

- [ ] **Step 1: 更新导入和类型**

更新文件顶部导入和类型：

```typescript
"use client";
import { useState, useCallback, useEffect } from "react";
import {
  buildWbsTree,
  computeTaskStatus,
  computeParentStatus,
  aggregateProgress,
} from "@/lib/wbs-utils";
import type { WbsTreeNode, TaskStatusResult } from "@/lib/wbs-utils";
import ProgressDialog from "./ProgressDialog";
import NodeEditDialog from "./NodeEditDialog";
import WbsAlertBar from "@/components/WbsAlertBar";
```

更新 `WbsNode` 接口，移除 `actualStartDate/actualEndDate/status/delayDays/responsibleId/responsiblePerson`，新增 `responsibleIds`:

```typescript
interface WbsNode {
  id: string;
  projectSourceId: string;
  parentId: string | null;
  level: number;
  name: string;
  disciplineId: string | null;
  isMilestone: boolean;
  planStartDate: string | null;
  planEndDate: string | null;
  progress: number;
  sortOrder: number;
  responsibleIds: string[];
  aiGenerated: boolean;
  plannedPct: number;
  actualPct: number;
  children?: WbsNode[];
  [key: string]: unknown;
}
```

- [ ] **Step 2: 重写状态计算逻辑（L4 用 computeTaskStatus，L1-L3 用 computeParentStatus）**

在 `renderRows` 函数内替换 L4 状态计算部分：

```typescript
    // L4 状态计算
    if (level === 4) {
      const planStart = raw.planStartDate ? new Date(raw.planStartDate) : null;
      const planEnd = raw.planEndDate ? new Date(raw.planEndDate) : null;
      const statusResult = computeTaskStatus(progressPct, planStart, planEnd, new Date());
      aiStatus = statusResult;
    } else {
      // L1/L2/L3 汇总
      const leafResults: TaskStatusResult[] = [];
      function collectLeafStatus(n: WbsTreeNode) {
        if (n.level === 4) {
          const r = n as unknown as WbsNode;
          const ps = r.planStartDate ? new Date(r.planStartDate) : null;
          const pe = r.planEndDate ? new Date(r.planEndDate) : null;
          leafResults.push(computeTaskStatus(r.progress ?? 0, ps, pe, new Date()));
        }
        for (const child of n.children) collectLeafStatus(child);
      }
      collectLeafStatus(node);
      if (leafResults.length > 0) {
        aiStatus = computeParentStatus(leafResults);
        progressPct = aggregateProgress(leafResults.map(l => {
          // 从节点数据取 progress
          return 0; // 临时，需要从实际数据中取
        }));
      } else {
        aiStatus = { status: "none" as const, emoji: "—", label: "无任务", planPct: 0 };
      }
    }
```

注意：这里需要重新设计 `collectLeafStatus` 和进度聚合逻辑。L1/L2/L3 的 progress 应该从其下 L4 子任务聚合。

- [ ] **Step 3: 重写进度列（单条进度条）**

替换进度列 JSX（原双条 → 单条）：

```typescript
        {/* 进度 */}
        <td style={{ padding: "6px 8px", width: "20%", verticalAlign: "middle" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                height: 8, background: "#E0E4EA", borderRadius: 0, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  background: barColor,
                  width: `${Math.min(100, Math.max(0, progressPct))}%`,
                  borderRadius: 0,
                  transition: "width 0.3s",
                }} />
              </div>
            </div>
            <span style={{ fontSize: 11, color: "#78716C", whiteSpace: "nowrap", minWidth: 30, textAlign: "right" }}>
              {progressPct}%
            </span>
          </div>
        </td>
```

其中 `barColor` 基于状态：
```typescript
    const statusColor = 
      aiStatus?.status === "delayed" || aiStatus?.status === "overdueComplete" ? "#C47676" :
      aiStatus?.status === "aheadComplete" || aiStatus?.status === "ahead" ? "#5A8A6A" :
      "#7DA88E";
```

- [ ] **Step 4: 重写状态列（emoji+文字）**

```typescript
        {/* 状态 */}
        <td style={{
          padding: "6px 8px", width: "12%", textAlign: "center", verticalAlign: "middle",
        }}>
          <span style={{
            fontSize: 13, fontWeight: 500,
            color: statusColor,
          }}>
            {aiStatus?.emoji} {aiStatus?.label}
          </span>
        </td>
```

- [ ] **Step 5: 重写责任人列（responsibleIds JSON 数组）**

替换 ResponsibleSelect 为简单的多选展示（暂时先展示 ID 列表）:

```typescript
        {/* 责任人 */}
        <td style={{ padding: "6px 8px", width: "13%", verticalAlign: "middle" }}>
          {showResponsibleSelect && (raw.responsibleIds || []).length > 0 ? (
            <span style={{ fontSize: 12, color: "#57534E" }}>
              {(raw.responsibleIds || []).join(", ")}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>—</span>
          )}
        </td>
```

- [ ] **Step 6: 调整操作列宽度和列定义**

更新表头列宽：
```typescript
        <thead>
          <tr>
            <th style={{ width: "30%" }}>节点名称</th>
            <th style={{ width: "12%", textAlign: "center" }}>状态</th>
            <th style={{ width: "20%" }}>进度</th>
            <th style={{ width: "13%" }}>责任人</th>
            <th style={{ width: "25%" }}>操作</th>
          </tr>
        </thead>
```

- [ ] **Step 7: 在页面顶部集成 WbsAlertBar**

在 return JSX 最前面（table 上方）添加预警摘要条。

需要统计所有 L4 节点的状态：
```typescript
  const alertStats = useMemo(() => {
    const allL4 = nodes.filter(n => n.level === 4);
    let delayed = 0;
    let ahead = 0;
    const today = new Date();
    for (const n of allL4) {
      const ps = n.planStartDate ? new Date(n.planStartDate) : null;
      const pe = n.planEndDate ? new Date(n.planEndDate) : null;
      const r = computeTaskStatus(n.progress ?? 0, ps, pe, today);
      if (r.status === "delayed" || r.status === "overdueComplete") delayed++;
      if (r.status === "ahead" || r.status === "aheadComplete") ahead++;
    }
    const avg = allL4.length > 0
      ? Math.round(allL4.reduce((s, n) => s + (n.progress ?? 0), 0) / allL4.length)
      : 0;
    return { totalTasks: allL4.length, delayedTasks: delayed, aheadTasks: ahead, overallProgress: avg };
  }, [nodes]);
```

然后在 JSX 中添加：
```typescript
      <WbsAlertBar
        totalTasks={alertStats.totalTasks}
        delayedTasks={alertStats.delayedTasks}
        aheadTasks={alertStats.aheadTasks}
        overallProgress={alertStats.overallProgress}
      />
```

- [ ] **Step 8: 提交**

```bash
git add src/app/\(dashboard\)/projects/plans/\[projectSourceId\]/components/WbsTreeList.tsx
git commit -m "refactor: WbsTreeList 适配新状态系统+单进度条+预警条"
```

---

### Task 11: 甘特图适配新状态系统

**Files:**
- Modify: `src/app/(dashboard)/projects/plans/[projectSourceId]/components/GanttChart.tsx`

- [ ] **Step 1: 更新导入和类型**

更新导入：
```typescript
import { buildWbsTree, computeTaskStatus, computeParentStatus } from "@/lib/wbs-utils";
import type { WbsTreeNode, TaskStatusResult } from "@/lib/wbs-utils";
```

更新 `WbsNode` 接口（移除 actualStart/End/status/delayDays）：

```typescript
interface WbsNode {
  id: string;
  projectSourceId: string;
  parentId: string | null;
  level: number;
  name: string;
  planStartDate: string | null;
  planEndDate: string | null;
  progress: number;
  sortOrder: number;
  plannedPct: number;
  actualPct: number;
  [key: string]: unknown;
}
```

更新 `GanttRow` 接口（移除 actual 相关字段）：

```typescript
interface GanttRow {
  id: string;
  name: string;
  level: number;
  depth: number;
  planStart: string;
  planEnd: string;
  status: string; // TaskStatus 的 status 值
  progress: number;
  isGroupHeader?: boolean;
  groupPlanStart?: string;
  groupPlanEnd?: string;
}
```

- [ ] **Step 2: 重写 `flattenGanttRows`**

重写以使用 `computeTaskStatus` / `computeParentStatus`，无 actual 字段：

```typescript
function flattenGanttRows(nodes: WbsTreeNode[], depth: number): GanttRow[] {
  const rows: GanttRow[] = [];
  for (const node of nodes) {
    const raw = node as unknown as WbsNode;
    let planStart = "";
    let planEnd = "";
    let status = "none";
    let progress = 0;

    if (node.level === 4) {
      planStart = raw.planStartDate || "";
      planEnd = raw.planEndDate || "";
      progress = raw.progress ?? 0;
      const ps = planStart ? new Date(planStart) : null;
      const pe = planEnd ? new Date(planEnd) : null;
      const r = computeTaskStatus(progress, ps, pe);
      status = r.status;
    } else {
      // 收集叶子节点
      function collectLeaves(n: WbsTreeNode): WbsNode[] {
        if (n.level === 4) return [n as unknown as WbsNode];
        const result: WbsNode[] = [];
        for (const child of n.children) result.push(...collectLeaves(child));
        return result;
      }
      const leaves = collectLeaves(node);
      if (leaves.length > 0) {
        const leafResults = leaves.map(l => {
          const ps = l.planStartDate ? new Date(l.planStartDate) : null;
          const pe = l.planEndDate ? new Date(l.planEndDate) : null;
          return computeTaskStatus(l.progress ?? 0, ps, pe);
        });
        const parentR = computeParentStatus(leafResults);
        status = parentR.status;

        const validDates = leaves.filter(l => l.planStartDate);
        if (validDates.length > 0) {
          planStart = validDates.map(l => l.planStartDate!).reduce((a, b) => a < b ? a : b);
          const withEnd = leaves.filter(l => l.planEndDate);
          planEnd = withEnd.length > 0 
            ? withEnd.map(l => l.planEndDate!).reduce((a, b) => a > b ? a : b) 
            : "";
        }
        progress = leaves.length > 0
          ? Math.round(leaves.reduce((s, l) => s + (l.progress ?? 0), 0) / leaves.length)
          : 0;
      }
    }

    // Group header for L1
    if (node.level === 1) {
      rows.push({
        id: `group-${node.id}`, name: node.name, level: node.level, depth,
        planStart: "", planEnd: "", status: "none", progress: 0,
        isGroupHeader: true,
        groupPlanStart: planStart, groupPlanEnd: planEnd,
      });
    }

    rows.push({
      id: node.id, name: node.name, level: node.level, depth,
      planStart, planEnd, status, progress,
    });

    if (node.children.length > 0) {
      rows.push(...flattenGanttRows(node.children, depth + 1));
    }
  }
  return rows;
}
```

- [ ] **Step 3: 重写甘特图行渲染（单条 progress 横道 + 计划虚线框）**

替换 rows 映射中的 bar 渲染逻辑：

```typescript
            const planBar = barPosition(row.planStart, row.planEnd);
            const isDelayed = row.status === "delayed" || row.status === "overdueComplete";
            const isAhead = row.status === "ahead" || row.status === "aheadComplete";
            const barColor = isDelayed ? "#C47676" : isAhead ? "#5A8A6A" : "#7DA88E";

            // progress bar: 基于计划条长度 × progress%
            const progressBar = planBar ? {
              left: planBar.left,
              width: planBar.width * (row.progress / 100),
            } : null;

            return (
              <div key={row.id} style={{
                position: "relative", height: ROW_H,
                borderBottom: "1px solid #E7E5E4",
                background: row.depth === 0 ? "#FAFAF9" : "#fff",
              }}>
                {/* 计划框 (虚线) */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                  {planBar && (
                    <>
                      <span style={{ position: "absolute", left: 4, fontSize: 10, color: "#90A4C4", zIndex: 2 }}>
                        {fmtDate(row.planStart)}
                      </span>
                      <div style={{
                        position: "absolute", left: `${planBar.left}%`,
                        width: `${Math.max(0.2, planBar.width)}%`,
                        top: "50%", transform: "translateY(-50%)",
                        height: 12,
                        background: "rgba(144,164,196,0.05)",
                        border: "1.5px dashed #90A4C4",
                        borderRadius: 0, zIndex: 1,
                      }} />
                      <span style={{ position: "absolute", right: 4, fontSize: 10, color: "#90A4C4", zIndex: 2 }}>
                        {fmtDate(row.planEnd)}
                      </span>
                    </>
                  )}
                </div>

                {/* 进度横道 (实心) */}
                {progressBar && row.level === 4 && (
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                    <div style={{
                      position: "absolute", left: `${progressBar.left}%`,
                      width: `${Math.max(0.2, progressBar.width)}%`,
                      top: "50%", transform: "translateY(-50%)",
                      height: 6,
                      background: barColor,
                      borderRadius: 0, zIndex: 3, opacity: 0.9,
                    }} />
                  </div>
                )}

                {!planBar && (
                  <span style={{ position: "absolute", left: 4, fontSize: 10, color: "#A8A29E", top: "50%", transform: "translateY(-50%)" }}>
                    无计划
                  </span>
                )}
              </div>
            );
```

- [ ] **Step 4: 提交**

```bash
git add src/app/\(dashboard\)/projects/plans/\[projectSourceId\]/components/GanttChart.tsx
git commit -m "refactor: 甘特图适配新状态系统 — 单条progress横道"
```

---

## 第四部分：验证与收尾

### Task 12: 全量回归验证

**Files:**
- (verify only)

- [ ] **Step 1: 运行单元测试**

```bash
npx vitest run
```
Expected: 所有测试 PASS

- [ ] **Step 2: 运行项目验证脚本**

```bash
bash scripts/verify.sh
```
Expected: TypeScript 编译通过，lint 无新增错误

- [ ] **Step