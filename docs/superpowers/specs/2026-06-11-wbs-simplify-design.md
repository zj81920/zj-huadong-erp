# WBS 计划系统简化设计

> 日期: 2026-06-11
> 状态: 设计完成，等待确认
> 目标: AI 驱动 + 数据模型极简化 + 操作精简

---

## 1. 背景与目标

### 1.1 痛点
- **人为操作过多**: 每个 L4 任务需手动填写进度%、实际开始日期、实际结束日期
- **判断逻辑复杂**: `judgeTaskStatus` 五态判断 + 5% 容忍度 + delayDays 反推公式 + `cascadeSummarize`，前后端各算一遍

### 1.2 目标
- **人为操作少**: 只填 progress%，其余 AI 自动处理
- **理解简单**: 状态纯函数计算，数据模型字段最少化
- **AI 赋能**: L4 任务自动生成、智能预警、自动报表

---

## 2. 数据模型变更

### 2.1 ProjectWbsNode 字段变更

| 变更 | 字段 | 说明 |
|------|------|------|
| 保留 | `planStartDate` | 计划开始日期 |
| 保留 | `planEndDate` | 计划结束日期 |
| 保留 | `progress` | 进度 0-100，手动填写 |
| 保留 | `isMilestone` | 里程碑标记 |
| 保留 | `responsibleId` → `responsibleIds` | 改为 JSON 数组支持多人 |
| 保留 | `version` | 乐观锁 |
| **删除** | `actualStartDate` | 不再维护实际开始日期 |
| **删除** | `actualEndDate` | 不再维护实际结束日期 |
| **删除** | `status` | 状态不再存储，改为实时计算 |
| **删除** | `delayDays` | 延误天数不再存储，改为实时计算 |
| **新增** | `aiGenerated` (Boolean) | 标记 AI 生成的任务节点 |

### 2.2 关系变更

- `parent` 关系添加 `onDelete: Cascade`，确保父节点删除时级联删除子节点

### 2.3 责任人变更

```diff
- responsibleId  String?   (单人)
+ responsibleIds Json      (JSON 数组 ["userId1","userId2"])
```

分配规则:
- L3 专业: 专业负责人(单选)
- L4 任务: 任务负责人(多人)
- 采购类 L2/L3: 可选负责人(单选)

---

## 3. 状态计算

### 3.1 核心公式

```
planPct = clamp((today - planStart) / (planEnd - planStart) × 100, 0, 100)
```

### 3.2 六种状态（纯函数，不存储）

判断优先级从上到下，命中即返回：

| 优先级 | 状态 | emoji | 条件 |
|--------|------|-------|------|
| 1 | 提前完成 | 🎉 | progress=100 且 today < planEndDate（当天的 00:00 比较） |
| 2 | 按期完成 | 🏁 | progress=100 且 today 与 planEndDate 是同一天 |
| 3 | 超期完成 | ⚠️ | progress=100 且 today > planEndDate |
| 4 | 提前 | 🚀 | progress>0 且 progress<100，且 (today < planStart 或 progress ≥ planPct) |
| 5 | 延误 | ⚠️ | progress>0 且 progress<100 且 today ≥ planStart 且 progress < planPct；或 progress=0 且 today > planStart（应开始但未开始） |
| 6 | 正常 | ✅ | progress=0 且 today ≤ planStart（等待开始） |

注：planPct = clamp((today - planStart) / (planEnd - planStart) × 100, 0, 100)。当 planStart=planEnd 时 planPct=100。

### 3.3 上级节点汇总

L1/L2/L3 的状态由其下所有 L4 子任务聚合:
- 状态: 有进行中→进行中，全部完成→已完成，否则→未开始
- 延误: 任一子任务延误→延误

### 3.4 实现位置

- 前端纯函数（`src/lib/wbs-utils.ts` 重构）：一个 `computeTaskStatus(progress, planStart, planEnd, today)` 函数
- 后端去掉 `judgeTaskStatus`、`cascadeSummarize`、`delayDays` 计算
- 进度 API 只做：校验 + 更新 progress + 自动设 actualStart/End 逻辑移除

---

## 4. AI 能力

### 4.1 AI 生成 L4 任务

**触发**: 用户在 L3（专业）节点上点击「🤖 生成任务」
**输入**: 项目类型(石油化工) + 阶段名 + 子项名 + 专业名
**输出**: 该专业下典型设计任务清单（任务名 + 建议工期），用户可勾选/编辑/增删后批量创建

职责划分:
- L1 阶段: 来自 Project.designPhases
- L2 子项: 用户手动创建
- L3 专业: 用户从 DisciplineDictionary 选择
- **L4 任务: AI 生成**

### 4.2 AI 延误预警

- 页面顶部固定预警摘要条：延误任务数 / 正常任务数 / 整体进度%
- 列出具体延误任务及原因
- 纯前端计算，加载 WBS 数据后实时筛选

### 4.3 AI 报告生成

- 项目标题栏「🤖 AI 报告」按钮
- 聚合所有任务进度数据 + 状态标签，调用 LLM 生成结构化报告
- 包含：整体进展 / 延误预警 / 本周完成 / 下周计划 / 亮点（提前完成项）
- 支持一键复制、导出

---

## 5. UI 变更

### 5.1 页面布局

```
┌─────────────────────────────────────────┐
│ ⚠️ 预警摘要：延误3项 | 整体45% | 风险等级  │  ← 新增
├─────────────────────────────────────────┤
│ 项目标题                     [🤖 AI报告] │  ← 新增按钮
├─────────────────────────────────────────┤
│ [树形列表] [甘特图]                       │
├─────────────────────────────────────────┤
│ ...表格 / 甘特图内容...                   │
└─────────────────────────────────────────┘
```

### 5.2 树形列表（5 列）

| 列 | 宽度 | 变化 |
|----|------|------|
| 节点名称 | 35% | L4 名称旁显示计划日期范围 |
| 状态 | 12% | emoji+文字（6种），替换 AIStatusBadge |
| 进度 | 25% | **单条**进度条（颜色反映状态），替换双条 |
| 责任人 | 13% | L3 单选下拉，L4 多选标签（×移除 + +添加） |
| 操作 | 15% | L4: 进度/日志/删除(3个)，L3: +添加/🤖生成任务/编辑/删除 |

### 5.3 甘特图

- 只显示计划横道（虚线框）+ 实际进度横道（progress% × 计划条长度，实心）
- 颜色: 绿=正常/提前，红=延误
- Today 红线贯穿

### 5.4 进度弹窗

- 合并原「编辑」功能：修改任务名 + 计划日期 + 里程碑标记 + 进度%
- 只填 progress%，不再填实际日期

---

## 6. 阶段同步机制

### 6.1 来源

L1 阶段来自 `Project.designPhases`，项目创建/更新时自动同步。

### 6.2 行为

| 场景 | 触发 | WBS 响应 |
|------|------|----------|
| 增加阶段 | 项目详情勾选新阶段 | 创建空 L1 节点 |
| 减少阶段 | 项目详情取消勾选 | **弹窗确认后**级联删除 L1+子树 |
| 删除项目 | 管理员操作 | 级联删除所有 WBS 数据 |

### 6.3 修复

- 复用 `deleteChildren()` 递归删除逻辑（当前减少阶段/删除项目的代码未正确级联删除子节点）
- Prisma schema parent 关系添加 `onDelete: Cascade` 作为数据库层兜底

---

## 7. 数据流

```
用户更新 progress%
  ↓
PUT /api/.../nodes/[id]/progress  { progress }
  ↓
后端: 校验 → 更新 progress → 返回节点
  ↓
前端: 重新 GET 所有节点 → computeTaskStatus() 实时计算状态
  ↓
UI: 更新预警摘要条 + 树形列表状态列 + 甘特图横道
```

**不再执行**: `cascadeSummarize`、`syncProjectDates`（移除）

---

## 8. 实现范围

### 8.1 数据层
- [ ] Prisma schema 变更（删除 4 字段，新增 1 字段，responsibleId→responsibleIds，加 Cascade）
- [ ] 数据迁移脚本

### 8.2 后端
- [ ] 简化 progress API（去 actualStart/End 自动设置、去 delayDays、去状态推导）
- [ ] 阶段同步修复（减少阶段递归删除）
- [ ] AI 生成 L4 任务 API（调用 LLM）
- [ ] AI 报告生成 API（调用 LLM）
- [ ] 进度 API 适配 responsibleIds

### 8.3 前端
- [ ] `wbs-utils.ts` 重构：`computeTaskStatus()` 替代 `judgeTaskStatus`/`judgeParentStatus`
- [ ] 预警摘要条组件
- [ ] 树形列表：单进度条、新状态列、多选责任人、AI 按钮
- [ ] 甘特图：progress% 横道
- [ ] 进度弹窗：合并编辑功能
- [ ] AI 任务生成弹窗
- [ ] AI 报告生成弹窗

### 8.4 测试
- [ ] `wbs-utils.test.ts` 更新（`computeTaskStatus` 测试用例）
- [ ] `bash scripts/verify.sh` 回归验证
