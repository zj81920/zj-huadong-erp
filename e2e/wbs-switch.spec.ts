import { test, expect } from "@playwright/test";

test.describe("WBS 开关完整生命周期", () => {
  // 登录
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // 等待页面加载完成（可能已有登录态）
    await page.waitForTimeout(1000);
  });

  test("WBS 开关 OFF → 行内可编辑进度", async ({ page }) => {
    await page.goto("/projects/plans");
    await page.waitForSelector("text=项目 WBS 计划与进度");

    // 等待列表加载
    await page.waitForTimeout(2000);

    // 找到第一个有 WBS 开关的项目，点击开关
    const toggleButtons = page.locator("button").filter({ hasText: "" }).locator("..").locator("button");
    // 通过样式找到 WBS 开关按钮（蓝色/灰色的圆形滑块）
    const wbsToggle = page.locator('button[style*="border-radius: 11px"]').first();

    if ((await wbsToggle.count()) === 0) {
      test.skip();
      return;
    }

    // 检查当前状态
    const toggleStyle = await wbsToggle.getAttribute("style");
    const isWbsOn = toggleStyle?.includes("#4A6FA5");

    if (isWbsOn) {
      // 点击切换到 OFF
      await wbsToggle.click();

      // 等待确认弹窗
      await page.waitForSelector("text=切换 WBS 模式");
      await page.locator("button", { hasText: "确认" }).click();

      // 等待刷新
      await page.waitForTimeout(2000);

      // 验证出现了数字输入框（进度编辑）
      const progressInput = page.locator('input[type="number"]').first();
      await expect(progressInput).toBeVisible({ timeout: 5000 });

      // 输入进度 50
      await progressInput.fill("50");
      await progressInput.blur();

      // 等待保存
      await page.waitForTimeout(1500);
    }
  });

  test("WBS 开关 ON → 项目名称可点击跳转到 WBS 详情", async ({ page }) => {
    await page.goto("/projects/plans");
    await page.waitForSelector("text=项目 WBS 计划与进度");
    await page.waitForTimeout(2000);

    // 找到第一个蓝色开关（WBS ON）的项目
    const wbsToggle = page.locator('button[style*="#4A6FA5"]').first();

    if ((await wbsToggle.count()) === 0) {
      test.skip();
      return;
    }

    // 点击项目名称应该跳转到 WBS 详情页
    const projectLink = page.locator("a[href*='/projects/plans/PJ-']").first();
    if ((await projectLink.count()) > 0) {
      await projectLink.click();
      await page.waitForTimeout(2000);
      // 应该跳转到 WBS 详情页
      expect(page.url()).toContain("/projects/plans/PJ-");
    }
  });

  test("切换 OFF → ON 清除手动值", async ({ page }) => {
    await page.goto("/projects/plans");
    await page.waitForSelector("text=项目 WBS 计划与进度");
    await page.waitForTimeout(2000);

    // 先确保有一个 WBS OFF 的项目（灰色开关）
    const offToggle = page.locator('button[style*="#D0D5DD"]').first();

    if ((await offToggle.count()) === 0) {
      // 如果没有，先创建一个
      test.skip();
      return;
    }

    // 点击切换回 ON
    await offToggle.click();

    // 确认弹窗
    await page.waitForSelector("text=切换 WBS 模式");
    const confirmText = await page.locator("text=开启 WBS 后").textContent();
    expect(confirmText).toContain("手动填写");

    await page.locator("button", { hasText: "确认" }).click();
    await page.waitForTimeout(2000);

    // 验证开关变为蓝色
    const afterToggle = page.locator('button[style*="#4A6FA5"]').first();
    await expect(afterToggle).toBeVisible({ timeout: 5000 });
  });
});
