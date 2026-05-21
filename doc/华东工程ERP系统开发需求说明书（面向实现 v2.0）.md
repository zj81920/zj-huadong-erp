# 安徽华东化工医药工程有限责任公司 ERP 系统开发需求说明书（面向实现 v2.0）

## 0. 核心数据模型与全局关联规则

### 0.1 全局唯一标识：项目源ID（project_source_id）
- **格式**：`PJ-YYYY-XXXX`（如 PJ-2025-0001），系统自动生成。
- **生成时机**：在“市场开发 → 项目线索登记”时生成，后续所有**需要关联项目的业务**（采购、项目相关报销、项目合同）**必须**携带此ID。
- **作用**：实现全生命周期追溯，从线索到项目关闭的所有数据通过此ID关联。

### 0.2 核心实体关系图（逻辑描述）
项目线索 (project_lead) --1:1--> 项目立项 (project) --1:n--> 采购需求 (purchase_request)
--1:n--> 费用报销 (expense_report) [可空]
--1:n--> 收入合同 (income_contract)
--1:n--> 支出合同 (expense_contract) [可空]
--1:n--> 投标记录 (bidding)
--1:n--> 应收/应付 (receivable/payable)

采购需求 --1:1--> 询价单 (inquiry) --1:1--> 采购合同 (purchase_contract) --1:n--> 到货验收 (delivery)

费用报销 --n:1--> 项目预算 (project_budget) [仅当关联项目时]

text

### 0.3 全局业务规则

| 规则ID | 规则内容 | 涉及模块 |
|--------|----------|----------|
| R-01 | 任何采购业务（需求、询价、合同）必须关联项目源ID，无项目不允许采购 | 采购管理 |
| R-02 | 费用报销若关联项目，则计入项目成本；若不关联，计入公司期间费用 | 费用管理、财务管理 |
| R-03 | 所有审批流节点必须填写审批意见，不可空 | 所有审批 |
| R-04 | 收入合同/支出合同变更需保留原合同版本并重新走审批 | 合同管理 |
| R-05 | 项目关闭前需校验：所有采购需求已完成、所有应付款已结清、所有外包任务已验收 | 项目管理 |
| **R-06** | **公司级与项目级区分**：<br> - 费用报销、支出合同、非合同收支的“是否关联项目”由用户选择（`project_source_id` 可为空）。<br> - 若关联项目：受项目预算控制（超预算预警），计入项目成本，在项目成本表中体现。<br> - 若不关联项目（公司级）：不受项目预算控制，不计入任何项目成本，单独在公司级财务报表中汇总。<br> - 审批流：项目级的报销/支出合同需经过“项目经理”节点；公司级的无项目经理节点（其他节点相同）。 | 费用管理、合同管理、财务管理 |

---

## 1. 系统模块依赖关系总览

| 模块名称 | 依赖数据（来自其他模块） | 对外提供数据（被依赖） |
|----------|--------------------------|------------------------|
| 市场开发 | 客户管理 | 项目线索 → 项目立项 |
| 项目立项 | 客户、投标记录（可选） | 项目实体 → 所有业务模块 |
| 采购管理 | 项目信息、项目计划（采购计划） | 采购合同 → 应付管理 |
| 费用管理 | 项目预算（可选）、项目信息（可选） | 费用报销单 → 应付管理 / 成本归集 |
| 合同管理（收入） | 项目信息（可选）、客户信息 | 应收管理 |
| 合同管理（支出） | 项目信息（可选）、供应商信息 | 应付管理 |
| 财务管理 | 应收/应付单、报销单、合同 | 财务报表、预算执行数据 |
| 设计外包管理 | 项目信息、供应商（或个人） | 外包费用 → 应付管理 / 项目成本 |

---

## 2. 详细模块需求（含模块间交互说明）

### 2.1 商务管理模块

#### 2.1.1 客户管理
- **数据表**：`customer`
- **字段**：id, name, address, contact_person, phone, email, maintainer, industry_type (石化/医药), customer_grade (A/B/C), created_at
- **关联**：被“市场开发”中的项目线索引用

#### 2.1.2 市场开发（核心：项目线索生成）
- **数据表**：`project_lead`
- **字段**：id, project_source_id (系统生成), customer_id (外键), project_name, location, estimated_investment, bid_release_time, info_source, current_status (潜在/意向/投标中/中标/未中标), follow_up_records (JSON), competitor_info (JSON)
- **业务规则**：
  - 创建时自动生成 `project_source_id`，固定不变
  - 当 `current_status` 变为“中标”时，允许通过系统操作“转为正式项目”，触发 `project` 表创建，且 `project.project_source_id` 沿用线索的ID
- **模块交互**：
  - 输出：项目线索 → 项目立项模块
  - 依赖：客户管理（customer_id 存在）

#### 2.1.3 投标管理
- **数据表**：`bidding`
- **字段**：id, project_source_id (外键), tender_file_registration, bid_deadline, bond_amount, bond_payment_status, bid_result (中标/未中标), bid_amount, score, fail_reason, attachment_url (投标文件)
- **业务规则**：
  - 保证金付款通过“付款申请”流程（见财务管理），付款完成后更新 `bond_payment_status`
  - 关联 `project_source_id`，可追溯到项目线索
- **模块交互**：
  - 依赖：项目线索（project_source_id）
  - 触发：保证金付款 → 财务管理 → 付款申请

#### 2.1.4 商务报价
- **数据表**：`quotation`
- **字段**：id, project_source_id (可空), customer_id, estimated_cost (人工/差旅/其他), total_amount, profit_margin, approval_status, version, adjustment_reason
- **审批流**：项目经理 → 部门负责人 → 财务 → 总经理
- **模块交互**：
  - 若报价基于某项目线索，则关联 `project_source_id`
  - 报价单审批通过后，可被“投标管理”引用作为投标报价

---

### 2.2 项目管理模块

#### 2.2.1 项目立项
- **数据表**：`project`
- **字段**：id, project_source_id (唯一, 外键), project_code (用户手工填, 唯一), name, customer_id, type (石化/医药), address, project_category (设计/EP/EPcm), source (中标/直接委托), status (筹备/执行/暂停/关闭/归档), members (JSON: 角色→用户ID)
- **业务规则**：
  - `project_source_id` 必须与已存在的 `project_lead.project_source_id` 匹配（若来源为中标）或由系统新生成（若直接委托）
  - 项目状态转换：筹备 → 执行 → (暂停↹执行) → 关闭 → 归档。关闭后不可新增采购/报销/合同
- **模块交互**：
  - 依赖：项目线索（project_lead）、客户（customer）
  - 被依赖：所有其他业务模块（通过 project_source_id）

#### 2.2.2 项目计划
- **数据表**：`project_plan`
- **字段**：id, project_source_id, plan_type (里程碑/设计/采购), plan_content, start_date, end_date, responsible_person, actual_progress (%), status, version
- **业务规则**：
  - 采购计划中的任务可以触发 `purchase_request` 的创建（建议自动生成草稿）
- **模块交互**：
  - 输出：采购计划内容 → 采购管理模块（采购需求可从计划生成）

#### 2.2.3 项目进度
- **数据表**：`project_progress`
- **字段**：id, project_source_id, task_node, planned_percentage, actual_percentage, delay_days, alert_status (正常/滞后)
- **模块交互**：
  - 通过API从外部设计文件审查系统同步完成节点 → 更新 `actual_percentage`
  - 进度预警触发消息推送 → 企业微信

#### 2.2.4 设计管理
- **数据表**：`design_task`
- **字段**：id, project_source_id, discipline, volume, drawing_no, assigned_to (user_id), planned_hours, actual_hours (手动录入或API同步), file_link (外部系统查看URL), change_record (JSON)
- **模块交互**：
  - `actual_hours` 可被薪酬管理的项目奖金计算引用（预留）

#### 2.2.5 设计外包管理
- **数据表**：`outsourcing_task`
- **字段**：id, project_source_id, type (to_company / to_person), target_name, contract_id (可空), task_description, workload, delivery_deadline, amount, acceptance_status, approval_status
- **业务规则**：
  - 若 `type=to_company`，必须关联支出合同（`expense_contract`）；若为 `to_person`，仅需任务书审批
  - 外包费用计入项目预算中的“设计外包费”科目
- **审批流**：设计负责人/生产经理 → 副总经理 → 总经理 → 董事长
- **模块交互**：
  - 依赖：项目预算（费用归属）
  - 输出：外包验收通过 → 触发应付管理（若有关联合同）

---

### 2.3 采购管理模块（核心：强关联项目）

#### 2.3.1 采购需求
- **数据表**：`purchase_request`
- **字段**：id, project_source_id (必须), request_type (设计需求/项目需求), material_name, spec, quantity, estimated_amount, required_date, status (草稿/审批中/已批准/已驳回/已转询价), approval_instance_id
- **审批流**：需求人 → 项目经理 → 采购部 → 副总经理 → 总经理 → 董事长
- **业务规则**：
  - 没有 `project_source_id` 不允许保存
  - 审批通过后，状态变为“已批准”，可由采购员操作“转询价”，此时创建 `inquiry` 记录
- **模块交互**：
  - 依赖：项目（project）
  - 触发：询价管理

#### 2.3.2 询价管理
- **数据表**：`inquiry`
- **字段**：id, purchase_request_id, project_source_id, supplier_ids (数组), inquiry_date, closing_date, quote_summary (JSON: 各供应商报价), recommended_supplier_id, is_single_source (布尔), single_source_reason
- **业务规则**：
  - 必须选择一个或多个合格供应商（来自供应商管理）
  - 询价完成后，可操作“生成采购合同”，自动填充 `purchase_contract` 草稿
- **模块交互**：
  - 依赖：采购需求、供应商管理
  - 输出：采购合同

#### 2.3.3 采购合同（属于支出合同的一种）
- **数据表**：`purchase_contract`
- **字段**：id, contract_no, project_source_id, supplier_id, inquiry_id, total_amount, payment_terms, signed_date, status (审批中/生效/变更中/关闭), approval_instance_id
- **审批流**：采购部 → 财务 → 副总经理 → 总经理 → 董事长
- **模块交互**：
  - 创建后自动在财务管理模块生成应付款计划（`payable` 记录，分期）
  - 合同生效后，采购需求状态更新为“已采购”

#### 2.3.4 到货验收
- **数据表**：`delivery_receipt`
- **字段**：id, purchase_contract_id, delivery_date, received_quantity, inspection_result (合格/不合格), receipt_status, invoice_matched (布尔)
- **业务规则**：
  - 验收合格后，通知财务模块可进行付款
- **模块交互**：
  - 依赖：采购合同
  - 输出：验收通过 → 更新应付状态

---

### 2.4 合同管理模块（收入/支出）

#### 2.4.1 收入合同
- **数据表**：`income_contract`
- **字段**：id, contract_no, project_source_id (可空), customer_id, signed_date, total_amount, split_stages (JSON: 阶段名→金额), status, approval_instance_id, scanned_url
- **审批流**：
  - 项目相关：行政 → 项目管理部 → 财务 → 副总经理 → 总经理 → 董事长
  - 项目无关：行政 → 财务 → 副总经理 → 总经理 → 董事长
- **模块交互**：
  - 审批通过后，自动在财务管理模块生成应收计划（`receivable` 记录，按阶段拆分）
  - 关联 `project_source_id` 时，收入计入项目产值

#### 2.4.2 支出合同（含采购合同、设计外包合同、服务合同）
- **数据表**：`expense_contract`
- **字段**：id, contract_no, **project_source_id (可空，为空表示公司级支出)** , supplier_id, signed_date, total_amount, payment_terms, status, contract_type (采购/设计外包/其他/公司行政采购), approval_instance_id, scanned_url
- **审批流**：
  - 若 `project_source_id` 非空（项目相关）：行政 → 项目管理部 → 财务 → 副总经理 → 总经理 → 董事长
  - 若 `project_source_id` 为空（公司级）：行政 → 财务 → 副总经理 → 总经理 → 董事长（无需项目管理部）
- **业务规则**：
  - 公司级支出合同（如公司办公场地租赁、IT服务采购）不关联任何项目，费用计入公司期间费用
  - 仍生成 `payable` 记录，但财务统计时归入公司级支出

#### 2.4.3 非合同收支
- **数据表**：`non_contract_income` / `non_contract_expense`
- **字段**：id, **project_source_id (可空)** , amount, transaction_date, counterparty, description, approval_instance_id
- **审批流**：
  - 若 `project_source_id` 非空：经办人 → 部门负责人 → 财务 → 副总经理 → 总经理 → 董事长
  - 若为空（公司级）：同上，但无需项目经理（部门负责人即可）
- **模块交互**：
  - 若关联项目，直接计入项目成本/收入
  - 若为公司级，计入公司其他业务收支

---

### 2.5 费用管理模块

#### 2.5.1 项目预算
- **数据表**：`project_budget`
- **字段**：id, project_source_id, budget_items (JSON: {category: "设计费", planned_amount, actual_amount, remaining}), approval_status, version
- **审批流**：项目经理 → 财务 → 副总经理 → 总经理
- **业务规则**：
  - 当费用报销或支出合同发生时，系统自动扣减对应预算科目的 `remaining`，并触发超预算预警（`actual > planned` 时推送消息）
- **模块交互**：
  - 被依赖：费用报销、采购合同、外包任务

#### 2.5.2 费用报销
- **数据表**：`expense_report`
- **字段**：id, **project_source_id (可空，为空表示公司级费用)** , expense_type, amount, description, attachment_url, **budget_category (仅当 project_source_id 非空时必填)** , status, approval_instance_id, loan_offset_amount
- **业务规则**：
  - 若 `project_source_id` 不为空：
    - 必须校验对应项目预算中该 `budget_category` 的剩余预算，超预算预警（可强制提交需备注）
    - 审批流程中增加“项目经理审批”节点
    - 费用计入该项目的成本
  - 若 `project_source_id` 为空（公司级费用）：
    - 不校验项目预算
    - 审批流程中**跳过项目经理**节点（直接由经办人部门负责人 → 财务 → 副总 → 总经理 → 董事长）
    - 费用计入“公司管理费用”科目，用于公司级财务报表
  - 报销审批通过后，无论是否关联项目，均生成 `payable` 记录（来源 `expense_report`）
- **模块交互**：
  - 依赖：项目预算（可选）、备用金借款
  - 输出：应付款记录、更新项目预算实际金额（若有关联）

#### 2.5.3 备用金借款
- **数据表**：`loan_request`
- **字段**：id, applicant_id, amount, reason, expected_return_date, status, repaid_amount, remaining_amount
- **业务规则**：
  - 借款审批通过后，生成应付款，财务付款
  - 报销时可选择冲抵该借款
- **模块交互**：
  - 被依赖：费用报销（冲抵）

#### 2.5.4 费用审批（通用）
- 通过工作流引擎实现，所有审批任务汇总到一个待办列表
- 审批动作触发状态变更和后续数据创建（如报销通过后创建应付）

---

### 2.6 财务管理模块

#### 2.6.1 应收管理
- **数据表**：`receivable`
- **字段**：id, source_type (income_contract/non_contract), source_id, project_source_id (可空), due_date, amount, paid_amount, status (未收/部分/已收/逾期)
- **生成时机**：
  - 收入合同审批通过后，根据合同拆分阶段生成多条 `receivable`
  - 非合同收入登记后生成一条
- **模块交互**：
  - 收款登记时核销 `receivable`

#### 2.6.2 应付管理
- **数据表**：`payable`
- **字段**：id, source_type (expense_contract/expense_report/loan_request), source_id, project_source_id (可空), due_date, amount, paid_amount, status
- **生成时机**：
  - 支出合同审批通过 → 按付款计划生成
  - 费用报销审批通过 → 生成一条应付
  - 借款审批通过 → 生成应付
- **模块交互**：
  - 付款申请关联 `payable`

#### 2.6.3 收付款登记与付款申请
- **付款申请**：`payment_application`
  - 字段：id, payable_id, applicant_id, amount, approval_status
  - 审批流：相关人 → 财务 → 副总经理 → 总经理 → 董事长 → 出纳
- **收款登记**：`receipt_voucher`
  - 字段：id, receivable_id, amount, receipt_date, bank_account
- **付款登记**：`payment_voucher`
  - 字段：id, payment_application_id, amount, payment_date, bank_account

#### 2.6.4 财务报表

| 序号 | 功能 | 说明 |
|------|------|------|
| 1 | 收支汇总表 | 按月/季/年汇总收入、支出、利润（区分项目级与公司级） |
| 2 | 项目成本表 | 按项目汇总成本，仅包含关联该项目的费用 |
| 3 | 应收账款账龄 | 应收款逾期账龄分析 |
| 4 | 应付账款账龄 | 应付款逾期账龄分析 |
| 5 | 现金流表 | 现金流入流出汇总 |
| 6 | 自定义报表 | 支持自定义财务统计报表 |
| 7 | **公司级费用汇总表** | 按月/季/年汇总公司管理费用（不关联项目的报销、支出合同、非合同支出），区分费用类型 |
| 8 | **公司级与项目级对比** | 展示公司总支出、项目总成本、公司管理费用的占比 |
| 9 | 导出功能 | 支持导出Excel/PDF |

#### 2.6.5 股东出资管理
- **数据表**：`shareholder`、`capital_contribution`、`equity_change`
- **无审批流，直接登记**，自动计算持股比例

---

### 2.7 人事管理模块（与其它模块弱关联，仅提供员工信息）

- 员工档案被项目成员、报销申请人、审批人等引用
- 考勤数据从企业微信同步，用于薪酬计算
- 薪酬发放不直接影响财务模块（可预留接口导出工资单）

### 2.8 行政管理模块
- 办公用品、证照、印章管理相对独立，不与项目强制关联

---

## 3. 关键业务流程的数据流描述（供AI实现时遵循）

### 3.1 项目线索到立项流程
1. 用户填写 `project_lead` → 系统自动生成 `project_source_id`
2. 线索状态变为“中标” → 用户点击“转为正式项目” → 创建 `project` 记录，`project.project_source_id = project_lead.project_source_id`
3. `project` 创建成功后，允许后续模块使用该 `project_source_id`

### 3.2 采购业务完整流程
1. 项目成员创建 `purchase_request`（必须带 `project_source_id`）→ 审批通过
2. 采购员基于 `purchase_request` 创建 `inquiry` → 选供应商 → 记录报价 → 选择推荐供应商
3. 创建 `purchase_contract`（自动关联 `inquiry` 和 `project_source_id`）→ 合同审批通过
4. 合同生效后，系统生成 `payable` 记录（分期）
5. 到货登记 `delivery_receipt` → 验收合格 → 可发起付款申请
6. 付款申请审批通过 → 出纳登记付款 → 核销对应的 `payable`

### 3.3 费用报销影响项目预算（项目级）与公司级费用
1. 用户创建 `expense_report`，选择是否关联项目：
   - **若关联项目**：填写 `project_source_id` 和 `budget_category` → 系统校验对应项目预算剩余额度 → 超预算预警但允许提交（需填原因）→ 审批通过后更新项目预算实际金额 → 生成 `payable`
   - **若不关联项目**：`project_source_id` 为空 → 不校验预算 → 审批通过后直接生成 `payable`，标记为公司级费用
2. 后续付款流程同采购合同

### 3.4 合同变更流程
1. 用户在合同详情页点击“变更” → 复制原合同数据生成新版本，状态为“变更中”
2. 修改金额、范围等内容 → 重新提交审批
3. 审批通过后，原合同状态变为“已变更”，新合同生效
4. 财务模块：原合同的应收/应付计划作废，根据新合同重新生成

---

## 4. 审批流配置规则（开发要点）

- 每个审批流实例存储在 `approval_instance` 表，包含 `business_type`、`business_id`、`current_node`、`status`
- 审批节点顺序、审批人角色从 `approval_flow_definition` 表读取，管理员可动态配置
- 支持审批代理（`approval_delegate` 表：`delegator_user_id`、`delegate_to_user_id`、`start_time`、`end_time`）

### 4.1 审批流一览表（区分项目级/公司级）

| 业务类型 | 审批流程（项目级） | 审批流程（公司级） |
|----------|-------------------|--------------------|
| 费用报销 | 经办人 → 部门负责人 → **项目经理** → 财务 → 副总经理 → 总经理 → 董事长 | 经办人 → 部门负责人 → 财务 → 副总经理 → 总经理 → 董事长 |
| 支出合同 | 行政 → 项目管理部 → 财务 → 副总经理 → 总经理 → 董事长 | 行政 → 财务 → 副总经理 → 总经理 → 董事长 |
| 非合同收支 | 经办人 → 部门负责人 → 财务 → 副总经理 → 总经理 → 董事长 | 同左（部门负责人即可，无项目经理） |
| 收入合同 | 行政 → 项目管理部 → 财务 → 副总经理 → 总经理 → 董事长 | 行政 → 财务 → 副总经理 → 总经理 → 董事长 |
| 采购需求 | 需求人 → 项目经理 → 采购部 → 副总经理 → 总经理 → 董事长 | （不适用，采购需求必须关联项目） |
| 外包任务书 | 设计负责人/生产经理 → 副总经理 → 总经理 → 董事长 | （不适用，外包必须关联项目） |
| 投标保证金付款 | 负责人 → 副总经理 → 总经理 → 董事长 → 财务 → 出纳 | （不适用） |
| 备用金借款 | 经办人 → 部门负责人 → 财务 → 副总经理 → 总经理 → 董事长 | 同左（借款通常不关联项目，但可统一使用公司级流程） |
| 付款申请 | 相关人 → 财务 → 副总经理 → 总经理 → 董事长 → 出纳 | 同左 |
| 报价单 | 项目经理 → 部门负责人 → 财务 → 总经理 | （不适用） |
| 项目预算 | 项目经理 → 财务 → 副总经理 → 总经理 | （不适用） |

---

## 5. 技术实现提示（面向 Next.js + Prisma）

- 数据模型严格遵循上述表关系，在 Prisma schema 中定义外键约束
- API 设计遵循 RESTful，每个资源的创建/更新需校验业务规则（如采购需求必须提供 `project_source_id`）
- 前端页面路由按模块划分，但通过全局的项目选择器（ProjectSelector）确保用户操作时关联正确的项目；公司级业务提供一个“不关联项目”的选项（如复选框“公司级费用”）
- 待办消息通过企业微信 API 推送，需调用 `send_message` 接口

---

**文档版本**：面向实现 v2.0（增加公司级与项目级区分）
**编制日期**：2026年5月19日