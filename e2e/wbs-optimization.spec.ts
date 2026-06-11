import { test, expect } from "@playwright/test";

test.describe("WBS 模块优化", () => {
  test("项目立项表单包含项目内容描述字段", async ({ page }) => {
    // 登录
    await page.goto("/login");
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard");

    // 导航到项目立项
    await page.goto("/projects");
    await page.waitForSelector("text=项目立项");
    await page.waitForTimeout(2000);

    // 点击新建
    await page.click("text=新建项目");
    await page.waitForTimeout(1000);

    // 验证项目内容描述字段存在（textarea）
    const descField = page.locator("textarea").first();
    await expect(descField).toBeVisible();
    await descField.fill("这是一个石化设计项目，包含工艺设计、管道设计等");
    await expect(descField).toHaveValue("这是一个石化设计项目，包含工艺设计、管道设计等");
  });

  test("WBS 列表页列布局正确", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard");

    await page.goto("/projects/plans");
    await page.waitForSelector("text=项目 WBS 计划与进度");
    await page.waitForTimeout(2000);

    // 验证表头包含正确的列
    const pageText = await page.locator("body").innerText();
    expect(pageText).toContain("项目编号");
    expect(pageText).toContain("甲方");
    expect(pageText).toContain("设计阶段");
    expect(pageText).toContain("进度");
    expect(pageText).toContain("状态");
  });
});
