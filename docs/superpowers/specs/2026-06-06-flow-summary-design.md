# 审批流程摘要功能设计文档

**日期**: 2026-06-06
**状态**: 设计中

---

## 概述

在待处理列表和通知中心中，为每个审批项显示「业务类型标签：业务标题」格式的流程摘要，如「供应商：XX科技有限公司」、「支出合同：2024年度采购合同」。

---

## 需求

| 位置 | 当前展示 | 期望展示 |
|------|---------|---------|
| 待处理列表 | 仅业务类型标签 | `供应商：XX科技有限公司` |
| 通知中心 | `供应商审批 待审批` | `供应商：XX科技有限公司 - 待审批` |

---

## 方案

### 数据层

`ApprovalInstance` 表新增 `businessTitle` 字段（String?），在发起审批时由业务方传入：

```prisma
model ApprovalInstance {
  // ... existing fields ...
  businessTitle String?  // 新增：业务标题，如供应商名称、合同名称
}
```

### 后端

1. **`startApprovalFlow()`** 新增 `businessTitle` 参数，存入 `ApprovalInstance`
2. **`POST /api/approval-instances`** 接收 `businessTitle` 并透传给引擎
3. **`GET /api/approval-instances`** (pending/processed/initiated) 返回 `businessTitle`
4. **通知创建**：`processApprovalAction()` 中通知 `title` 改为 `{业务标签}：{businessTitle} - 待审批`

### 前端

1. **各业务模块页面**：发起审批时，在 POST body 中传入 `businessTitle`（取业务实体的名称字段）
2. **待处理列表**：表格中渲染 `{业务类型标签}：{businessTitle}` 格式
3. **通知中心**：无需改（通知 title 已在创建时包含摘要）

---

## 涉及文件

| 层 | 文件 | 改动 |
|----|------|------|
| Schema | `prisma/schema.prisma` | `ApprovalInstance` 新增 `businessTitle String?` |
| Schema 同步 | 运行命令 | `npx prisma db push` |
| 引擎 | `src/lib/approval-engine.ts` | `startApprovalFlow` 加 `businessTitle` 参数；通知 title 使用业务标题 |
| API | `src/app/api/approval-instances/route.ts` | POST 接收 `businessTitle`；GET 返回 `businessTitle` |
| 前端页面 | `src/app/(dashboard)/approvals/page.tsx` | 待处理表格显示摘要 |
| 前端调用方 | 各业务模块页面（~16个） | POST 发起审批时传入 `businessTitle` |

---

## 注意事项

- `businessTitle` 为可选字段，兼容已有数据和未传的业务模块
- 前端渲染时降级处理：`{BUSINESS_TYPE_LABELS[type]}：{businessTitle || "—"}`
- Schema 变更后需执行 `npx prisma db push` + `bash scripts/verify.sh`
