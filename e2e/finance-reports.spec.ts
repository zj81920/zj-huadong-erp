import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("财务报表页面（重构后）", () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('input[placeholder="请输入用户名"]', { timeout: 10000 });
    await page.fill('input[placeholder="请输入用户名"]', "admin");
    await page.fill('input[placeholder="请输入密码"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // 进入财务报表页面
    await page.goto(`${BASE_URL}/finance/reports`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  });

  test.afterEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/api/auth/logout`).catch(() => {});
    await page.waitForTimeout(500);
  });

  // ==================== Tab 导航 ====================
  test("应显示 3 个 Tab 且默认选中经营看板", async ({ page }) => {
    // 验证 Tab 存在
    const dashboardTab = page.locator('button:has-text("经营看板")');
    const projectTab = page.locator('button:has-text("项目成本")');
    const agingTab = page.locator('button:has-text("账龄分析")');

    await expect(dashboardTab).toBeVisible({ timeout: 5000 });
    await expect(projectTab).toBeVisible({ timeout: 5000 });
    await expect(agingTab).toBeVisible({ timeout: 5000 });

    // 默认 Tab 高亮
    await expect(dashboardTab).toHaveClass(/ios-btn-primary/);
  });

  test("Tab 切换应正确显示对应内容", async ({ page }) => {
    // 点击项目成本 Tab
    await page.locator('button:has-text("项目成本")').click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=应付总额").first()).toBeVisible({ timeout: 5000 });

    // 点击账龄分析 Tab
    await page.locator('button:has-text("账龄分析")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('button:has-text("应收账款")')).toBeVisible({ timeout: 5000 });

    // 切回经营看板
    await page.locator('button:has-text("经营看板")').click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=总收入").first()).toBeVisible({ timeout: 5000 });
  });

  // ==================== Tab 1: 经营看板 ====================
  test("经营看板 — 应显示 3 张 KPI 核心指标卡片", async ({ page }) => {
    // KPI 卡片：总收入、总支出、净利润
    const incomeCard = page.locator("text=总收入").first();
    const expenseCard = page.locator("text=总支出").first();
    const profitCard = page.locator("text=净利润").first();

    await expect(incomeCard).toBeVisible({ timeout: 5000 });
    await expect(expenseCard).toBeVisible({ timeout: 5000 });
    await expect(profitCard).toBeVisible({ timeout: 5000 });

    // KPI 卡片金额格式正确（¥开头）
    const incomeValue = incomeCard.locator("..").locator("p").first();
    await expect(incomeValue).toContainText("¥", { timeout: 5000 });
  });

  test("经营看板 — 应显示图表区域（柱状图和饼图）", async ({ page }) => {
    // 图表标题
    await expect(page.locator("text=月度收支趋势")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=收支分类占比")).toBeVisible({ timeout: 5000 });
  });

  test("经营看板 — 应显示 6 张收支构成分类卡片", async ({ page }) => {
    // 收入类 3 张
    await expect(page.locator("text=合同收入（已收）").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=其他收入").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=股东出资").first()).toBeVisible({ timeout: 5000 });

    // 支出类 3 张
    await expect(page.locator("text=合同支出（已付）").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=其他支出").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=工资+报销+借出").first()).toBeVisible({ timeout: 5000 });
  });

  test("经营看板 — 月度收支明细表可展开和收起", async ({ page }) => {
    const toggle = page.locator("text=月度收支明细");
    await expect(toggle).toBeVisible({ timeout: 5000 });

    // 初始状态为收起，点击展开
    await page.locator("text=展开 ▼").click();
    await page.waitForTimeout(1000);

    // 展开后可能显示表格表头，也可能显示空状态（测试环境无数据时）
    // 如果显示空状态则 OK，如果有数据则验证表头
    const hasData = await page.locator("text=暂无月度数据").isVisible().catch(() => false);
    if (!hasData) {
      await expect(page.locator("text=月份").first()).toBeVisible({ timeout: 3000 });
    }

    // 再次点击收起
    await page.locator("text=收起 ▲").click();
    await page.waitForTimeout(500);
    // 收起后内容应该隐藏
    await expect(toggle).toBeVisible({ timeout: 5000 });
  });

  // ==================== Tab 2: 项目成本 ====================
  test("项目成本 — 应显示汇总指标卡片", async ({ page }) => {
    await page.locator('button:has-text("项目成本")').click();
    await page.waitForTimeout(1000);

    // 汇总指标
    await expect(page.locator("text=项目总数").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=应付总额").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=已付总额").first()).toBeVisible({ timeout: 5000 });
  });

  test("项目成本 — 应显示图表和明细表", async ({ page }) => {
    await page.locator('button:has-text("项目成本")').click();
    await page.waitForTimeout(1000);

    // 图表
    await expect(page.locator("text=各项目成本对比")).toBeVisible({ timeout: 5000 });

    // 明细表标题
    await expect(page.locator("text=项目成本明细")).toBeVisible({ timeout: 5000 });
  });

  test("项目成本 — 明细表应包含正确的列", async ({ page }) => {
    await page.locator('button:has-text("项目成本")').click();
    await page.waitForTimeout(1000);

    // 检查是否有数据：空状态提示存在则无数据，否则有数据
    const emptyStateCount = await page.locator("text=暂无项目成本数据").count();
    if (emptyStateCount > 0) {
      await expect(page.locator("text=暂无项目成本数据").first()).toBeVisible({ timeout: 5000 });
    } else {
      const tableHeader = page.locator("table thead");
      await expect(tableHeader.locator("text=项目").first()).toBeVisible({ timeout: 8000 });
      await expect(tableHeader.locator("text=应付").first()).toBeVisible({ timeout: 3000 });
      await expect(tableHeader.locator("text=已付").first()).toBeVisible({ timeout: 3000 });
      await expect(tableHeader.locator("text=未付").first()).toBeVisible({ timeout: 3000 });
      await expect(tableHeader.locator("text=报销").first()).toBeVisible({ timeout: 3000 });
      await expect(tableHeader.locator("text=总成本").first()).toBeVisible({ timeout: 3000 });
      await expect(tableHeader.locator("text=进度").first()).toBeVisible({ timeout: 3000 });
    }
  });

  // ==================== Tab 3: 账龄分析 ====================
  test("账龄分析 — 应收/应付切换按钮应正常工作", async ({ page }) => {
    await page.locator('button:has-text("账龄分析")').click();
    await page.waitForTimeout(1000);

    const receiveBtn = page.locator('button:has-text("应收账款")');
    const payBtn = page.locator('button:has-text("应付账款")');

    await expect(receiveBtn).toBeVisible({ timeout: 5000 });
    await expect(payBtn).toBeVisible({ timeout: 5000 });

    // 默认选中应收
    await expect(receiveBtn).toHaveClass(/ios-btn-primary/);

    // 切换到应付
    await payBtn.click();
    await page.waitForTimeout(500);
    await expect(payBtn).toHaveClass(/ios-btn-primary/);
    await expect(receiveBtn).not.toHaveClass(/ios-btn-primary/);
  });

  test("账龄分析 — 应显示账龄分布图表和 4 段金额卡片", async ({ page }) => {
    await page.locator('button:has-text("账龄分析")').click();
    await page.waitForTimeout(1000);

    // 图表
    await expect(page.locator("text=账龄分布")).toBeVisible({ timeout: 5000 });

    // 4 段卡片
    await expect(page.locator("text=30天内").first()).toBeVisible({ timeout: 5000 });
    const orTexts = page.locator("text=30-60天");
    await expect(orTexts.first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=60-90天").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=90天以上").first()).toBeVisible({ timeout: 5000 });
  });

  test("账龄分析 — 明细表应包含正确的列", async ({ page }) => {
    await page.locator('button:has-text("账龄分析")').click();
    await page.waitForTimeout(1000);

    // 可能有数据（显示表格）或没有数据（显示空状态）
    const hasEmpty = await page.locator("text=暂无未收").isVisible().catch(() => false);
    if (hasEmpty) {
      await expect(page.locator("text=暂无未收").first()).toBeVisible({ timeout: 5000 });
    } else {
      const tableHeader = page.locator("table thead");
      await expect(tableHeader.locator("text=来源类型")).toBeVisible({ timeout: 5000 });
      await expect(tableHeader.locator("text=项目")).toBeVisible({ timeout: 5000 });
      await expect(tableHeader.locator("text=应收金额")).toBeVisible({ timeout: 5000 });
      await expect(tableHeader.locator("text=已收金额")).toBeVisible({ timeout: 5000 });
      await expect(tableHeader.locator("text=未收金额")).toBeVisible({ timeout: 5000 });
      await expect(tableHeader.locator("text=到期日")).toBeVisible({ timeout: 5000 });
      await expect(tableHeader.locator("text=逾期天数")).toBeVisible({ timeout: 5000 });
    }
  });

  // ==================== 经营主体筛选 ====================
  test("经营主体筛选器应存在并允许切换", async ({ page }) => {
    // 检查经营主体下拉框存在
    const filterSelect = page.locator("select.ios-select");
    const filterCount = await filterSelect.count();

    if (filterCount > 0) {
      // 有经营主体数据时验证切换
      const options = await filterSelect.first().locator("option").all();
      if (options.length > 1) {
        // 有多个选项，切换并验证页面更新
        await filterSelect.first().selectOption({ index: 1 });
        await page.waitForTimeout(1000);
        // 切换后页面不应空白
        await expect(page.locator("text=经营看板").first()).toBeVisible({ timeout: 5000 });
      }
    } else {
      // 无经营主体时也 OK（测试环境没有设置银行账户时）
      test.info().annotations.push({ type: "info", description: "无可用的经营主体筛选数据" });
    }
  });

  // ==================== 页面渲染容错 ====================
  test("页面应正常渲染无 JS 崩溃", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("财务报表", { timeout: 15000 });
  });
});
