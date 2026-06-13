# WBS 模块优化设计文档

## 概述

对项目 WBS（工作分解结构）模块进行多项优化，包括：项目立项表单字段调整、AI 生成任务能力增强、任务管理功能完善、权限补充、UI 布局优化等。

---

## 1. 项目立项：类型字段替换为项目内容描述

### 1.1 数据库变更

**Project 模型**（`prisma/schema.prisma`）：

- 删除字段：`type`（原 `String?`，存"石化"/"医药"）
- 新增字段：
  ```
  projectContent   String?   @map("project_content") @db.Text
  ```

### 1.2 表单变更（`projects/page.tsx`）

- 删除"类型"下拉选择框（第 966-977 行）
- 在"项目名称"下方新增"项目内容描述"字段：
  - `col-span-2` 独占一行
  - 使用 `<textarea>`，placeholder="请输入项目概况、范围、技术要求等"
  - 3-4 行高度（rows=3）
  - 可自由输入长文本
- 表单接口 `ProjectFormData` 中 `type` 改为 `projectContent`
- 提交时 `body.type` 改为 `body.projectContent`
- 详情弹窗（第 1205-1269 行区域）中增加"项目内容描述"行

### 1.3 列表页筛选调整

- 删除"类型"筛选项（原第 605-616 行的 `filterType` select）

### 1.4 后端 API 变更

- `POST /api/projects` — 接收 `projectContent` 替代 `type`
- `PUT /api/projects/[id]` — 同上
- `GET /api/projects/[id]` — 返回 `projectContent` 字段
- `GET /api/projects` — 返回列表包含 `projectContent`（detail 模式）

---

## 2. AI 生成任务集成项目内容描述

### 2.1 变更文件

`src/app/api/projects/plans/[projectSourceId]/nodes/generate-tasks/route.ts`

### 2.2 变更内容

- 在查询项目信息时增加 `projectContent` 字段
  ```ts
  select: { name: true, type: true, projectCategory: true, projectContent: true },
  ```
- AI prompt 的 `userMessage` 中增加"项目内容描述"段落：
  ```
  项目类型：${projectType}
  项目名称：${projectName}
  项目内容描述：${projectContent || "无"}
  当前阶段：${phaseName}
  子项名称：${subItemName}
  专业名称：${disciplineName}
  
  请结合项目内容描述和项目阶段，列出该专业在此子项下需要完成的设计任务清单。
  ```

---

## 3. AI 覆盖式生成

### 3.1 前端变更（`WbsTreeList.tsx`）

在 `handleGenerateTasks` 函数中增加检测逻辑：

1. 查找当前 L3 节点下所有 `aiGenerated === true` 的 L4 子节点
2. 如果存在（`count > 0`），弹出确认对话框：
   > "该专业下已有 X 个 AI 生成的任务。重新生成将删除原有 AI 任务并重建，确定继续？"
3. 用户确认后，先调用删除 API 删除这些 AI 节点，再调用生成 API

### 3.2 后端支持

需要在生成 API 中增加可选参数 `overwrite: boolean`，或由前端分两步操作（先删后增）。推荐前端分两步：
- Step 1: `DELETE /api/projects/plans/:projectSourceId/nodes/:parentNodeId/ai-tasks`（新增批量删除 AI 任务的接口）
- Step 2: 调用原有的 `POST generate-tasks`

### 3.3 新增 API

`DELETE /api/projects/plans/:projectSourceId/nodes/:nodeId/ai-tasks`

- 删除指定 L3 节点下所有 `aiGenerated === true` 的 L4 子节点
- 返回删除数量

---

## 4. 清空 L4 任务（批量删除）

### 4.1 前端变更（`WbsTreeList.tsx`）

在 L3 节点的操作区新增按钮：

```
[清空任务]
```

- 点击弹出确认："确定清空该专业下的所有任务？此操作不可撤销"
- 确认后调用 `DELETE /api/projects/plans/:projectSourceId/nodes/:nodeId/tasks`
- 刷新列表

### 4.2 新增 API

`DELETE /api/projects/plans/:projectSourceId/nodes/:nodeId/tasks`

- 删除指定节点下所有 L4 子节点（无论是否 AI 生成）
- 返回删除数量

### 4.3 按钮可见性

- 仅在 L3 节点且 level=4 的子节点数量 > 0 时显示
- 可在渲染时判断 `hasL4Children` 决定是否展示

---

## 5. WBS 权限补充：节点负责人

### 5.1 变更文件

`src/lib/wbs-auth.ts`

### 5.2 变更内容

在 `canAccessProjectWbs` 函数中增加第 5 种权限途径：

```ts
// 检查当前用户是否为该项目的任一 WBS 节点的负责人
const isResponsible = await prisma.projectWbsNode.findFirst({
  where: {
    projectSourceId,
    responsibleIds: { has: user.id },
  },
});
if (isResponsible) return true;
```

此项检查位于设计经理/主管领导检查之后。

---

## 6. 专业节点（L3）编辑增加责任人选

### 6.1 变更文件

`src/app/(dashboard)/projects/plans/[projectSourceId]/components/NodeEditDialog.tsx`

### 6.2 变更内容

修改 `showResponsible` 计算逻辑：

```ts
// 旧逻辑：只对 L4 或采购 L3 显示责任人
const showResponsible = isLevel4 || (level === 3 && isProcurementTask);

// 新逻辑：L3 编辑时也显示责任人（所有 L3 节点都需要责任人）
const showResponsible = isLevel4 || level === 3;
```

同时，编辑模式的 `handleSave` 中，L3 的 body 也需包含 `responsibleIds`：

```ts
if (showResponsible) {
  body.responsibleIds = responsibleIds;
}
```

---

## 7. WBS 列表页分页优化

### 7.1 变更文件

`src/app/(dashboard)/projects/plans/page.tsx`

### 7.2 变更内容

- 保留现有的分页逻辑（page/pageSize 状态、API 已支持分页）
- 将底部的分页控件从简单按钮改为项目中通用的 `PaginationBar` 组件
- 确保 `PaginationBar` 能正确显示页码、总条数、页大小切换

### 7.3 PaginationBar 使用方式

```tsx
import PaginationBar from "@/components/PaginationBar";
import { usePagination } from "@/hooks/usePagination";

const { page, pageSize, setPage, setPageSize, pagination, setPagination } = usePagination({ defaultPageSize: 20 });

<PaginationBar pagination={pagination} onPageChange={setPage} onPageSizeChange={setPageSize} />
```

---

## 8. WBS 列表页列布局调整

### 8.1 列顺序和宽度调整

当前布局：

| 列 | 宽度 | 说明 |
|---|---|---|
| 项目编号 | 100px | 不变 |
| 项目名称 | 200px | 不变 |
| 设计阶段 | flex:1 | **过多空白** |
| 甲方 | 100px | 应左移 |
| 进度 | 110px | 应加宽 |
| 状态 | 80px | 不变 |
| 风险 | 40px | 不变 |

调整为：

| 列 | 宽度 | 说明 |
|---|---|---|
| 项目编号 | 100px | |
| 项目名称 | 200px | |
| 甲方 | 120px | 移到设计阶段前面，略加宽 |
| 设计阶段 | flex:1 | 居中位置，内容为 phase 标签 |
| 进度 | 150px | 加宽（进度条+百分比） |
| 状态 | 80px | |
| 风险 | 40px | |

### 8.2 行内样式调整

- 甲方文字左对齐
- 进度条容器加宽到 80px
- 整体左右 padding 保持不变

---

## 9. 变更文件清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `prisma/schema.prisma` | 修改 | Project 模型：删 type + 增 projectContent |
| `src/app/(dashboard)/projects/page.tsx` | 修改 | 表单/详情/筛选/接口调整 |
| `src/app/api/projects/route.ts` | 修改 | 增 projectContent 字段处理 |
| `src/app/api/projects/[id]/route.ts` | 修改 | 增 projectContent 字段处理 |
| `src/app/(dashboard)/projects/plans/[projectSourceId]/components/WbsTreeList.tsx` | 修改 | 覆盖生成检测、清空任务按钮 |
| `src/app/(dashboard)/projects/plans/[projectSourceId]/components/NodeEditDialog.tsx` | 修改 | L3 编辑加责任人 |
| `src/app/api/projects/plans/[projectSourceId]/nodes/generate-tasks/route.ts` | 修改 | prompt 增加项目内容描述 |
| `src/app/api/projects/plans/[projectSourceId]/nodes/[id]/route.ts` | 修改 | 新增 ai-tasks/tasks 子路由处理 |
| `src/lib/wbs-auth.ts` | 修改 | 增加负责人权限检测 |
| `src/app/(dashboard)/projects/plans/page.tsx` | 修改 | 分页改用 PaginationBar + 列布局调整 |

---

## 10. 测试策略

| 测试项 | 类型 | 说明 |
|--------|------|------|
| 项目字段变更 | 数据库验证 | `npx prisma validate` + `npx prisma db push` |
| WBS 权限-负责人 | 单元/手动 | 验证非 admin/非设计经理/非主管领导的负责人可访问 |
| AI 覆盖生成 | 手动 | 点击生成 → 确认弹窗 → 旧任务删除 → 新任务生成 |
| 清空任务 | 手动 | 点击清空 → 确认 → L4 全部删除 |
| L3 编辑责任人 | 手动 | 编辑 L3 专业节点，应出现责任人下拉 |
| 分页 | 手动 | 多页数据，切换页码正常 |
| 列布局 | 视觉 | 甲方在设计阶段前，进度条加宽 |
| 回归验证 | 自动化 | `bash scripts/verify.sh` |
