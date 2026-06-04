# 工资批次员工选择交互改进设计

## 概述

改进工资批次创建时"选择发放员工"的交互方式，从手动勾选 checkbox 列表改为自动包含所有在职员工并以内联表格展示明细。

## 现状问题

- 新建批次弹窗中，员工选择是一个 checkbox 列表（`max-h-[300px]` 滚动容器）
- 仅显示员工姓名，无部门/岗位信息
- 无搜索/筛选功能
- `/api/users` 有 `pageSize` 限制（默认 200），员工超过 200 人时显示不全
- 需要手动逐一勾选，员工多时操作效率低

## 设计方案（方案 C：内联表格）

### 整体流程

```
新建批次弹窗 → 自动加载所有在职员工（employmentStatus="active"）
→ 以内联表格展示薪酬明细 → 编辑金额 / 排除员工
→ 点击"创建批次"一次性提交
```

取代原来的两步流程（新建批次选择员工 → 再打开编辑明细弹窗）。

### 页面布局

#### 1. 基本信息区
- 工资周期（`<input type="month">`，保留）
- 批次名称（自动生成，保留）

#### 2. 汇总信息区（三行布局）

| 行 | 分类 | 包含项 | 背景色 |
|---|---|---|---|
| 第一行 | 基本指标 | 应发人数、应发总额、实发总额 | 默认 / 绿色（实发） |
| 第二行 | 代扣代缴（个人） | 代缴社保（个人）、代缴公积金（个人）、代缴个税 | 暖色橙底 |
| 第三行 | 公司承担 | 公司社保、公司公积金、公司总成本 | 蓝色底 |

汇总计算公式：

| 汇总项 | 公式 |
|---|---|
| 应发总额 | `SUM(grossSalary)` |
| 实发总额 | `SUM(netSalary)` |
| 代缴社保（个人） | `SUM(socialInsurancePersonal)` |
| 代缴公积金（个人） | `SUM(housingFundPersonal)` |
| 代缴个税 | `SUM(incomeTax)` |
| 公司社保 | `SUM(socialInsuranceCompany)` |
| 公司公积金 | `SUM(housingFundCompany)` |
| 公司总成本 | `应发总额 + 公司社保 + 公司公积金` |

#### 3. 内联表格

表格列：员工、基本工资、奖金、补贴、应发、社保个、公积金个、个税、其他扣、扣合计、实发、操作（✕/↩）

行为：
- 所有字段除员工姓名外均为可编辑 input（`type="number"`）
- 应发合计 = baseSalary + bonus + allowance（自动计算，只读）
- 扣款合计 = socialInsurancePersonal + housingFundPersonal + incomeTax + otherDeduction（自动计算，只读）
- 实发工资 = grossSalary - totalDeduction（自动计算，只读）
- 点击 ✕ 排除员工：该行显示删除线 + "已排除（点击恢复）"，数据从汇总中剔除
- 点击 ↩ 恢复员工：该行恢复正常，数据重新计入汇总
- 修改任意金额 → 对应行自动重算 → 顶部汇总实时更新

#### 4. 底部操作区
- 左侧：统计信息 "✓ 已包含 N 名在职员工 · 已排除 M 人"
- 右侧：取消 / 创建批次 按钮

### 后端变更

#### `/api/salary-batches` POST 接口

- 请求参数：不再需要 `employeeIds`
- 后端逻辑：如果未传 `employeeIds`，自动查询 `employmentStatus="active"` 的用户作为发放员工
- 保留 `employeeIds` 参数兼容性，如果传了则使用传入的列表（排除功能通过前端过滤后传入）
- 移除此接口中对 `pageSize` 的限制

#### `/api/users` GET 接口

- 新增查询参数支持：`employmentStatus` 筛选
- 用于前端预览时获取员工列表及薪酬数据

### 数据结构

```typescript
// 新增批次请求体
interface CreateBatchRequest {
  period: string;       // "2026-06"
  title: string;        // "2026年6月工资发放"
  employeeIds: string[]; // 实际发放的员工ID列表（已排除的不会在此）
  remark?: string;
}

// 前端内联表格行数据
interface BatchFormItem {
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  bonus: number;
  allowance: number;
  grossSalary: number;       // 自动计算
  socialInsurancePersonal: number;
  housingFundPersonal: number;
  incomeTax: number;
  otherDeduction: number;
  totalDeduction: number;    // 自动计算
  netSalary: number;         // 自动计算
  excluded: boolean;         // 是否被排除
}
```

### 涉及文件

| 文件 | 变更内容 |
|---|---|
| `src/app/(dashboard)/finance/expense/page.tsx` | 重写新建批次弹窗：移除 checkbox 列表，替换为汇总区 + 内联表格 |
| `src/app/api/salary-batches/route.ts` | 创建批次时支持自动获取在职员工，移除 pageSize 限制 |
| `src/app/api/users/route.ts` | 增加 employmentStatus 筛选参数 |
