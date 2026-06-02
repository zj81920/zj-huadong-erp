import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("费用报销流程", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('input[placeholder="请输入用户名"]');
    await page.fill('input[placeholder="请输入用户名"]', "admin");
    await page.fill('input[placeholder="请输入密码"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
  });

  test("应完整创建一条费用报销单并显示在列表中", async ({ page }) => {
    await page.goto(`${BASE_URL}/finance/expense`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("费用报销")').click();
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("新增报销")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator("h2:has-text('新增费用报销')")).toBeVisible({ timeout: 5000 });

    const dialog = page.locator(".ios-modal");

    await dialog.locator('input[placeholder="费用说明"]').fill("北京出差交通费");
    await dialog.locator('input[placeholder="金额"]').fill("1500");
    await dialog.locator("select").first().selectOption("差旅费");

    const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 10000 });
    const uploadResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/upload") && resp.status() === 200,
      { timeout: 15000 }
    );
    await dialog.locator('button:has-text("上传")').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "test-invoice.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(
        "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de",
        "hex"
      ),
    });
    await uploadResponsePromise;
    await page.waitForTimeout(1000);

    await expect(dialog.locator('a:has-text("发票1")')).toBeVisible({ timeout: 5000 });

    await dialog.locator('button:has-text("提交报销")').click();
    await page.waitForTimeout(3000);

    await expect(page.locator("h2:has-text('新增费用报销')")).not.toBeVisible({ timeout: 5000 });

    await expect(
      page.locator("table tbody tr:has(td:text('系统管理员'))").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("表单校验：空明细无法提交", async ({ page }) => {
    await page.goto(`${BASE_URL}/finance/expense`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("费用报销")').click();
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("新增报销")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator("h2:has-text('新增费用报销')")).toBeVisible({ timeout: 5000 });

    const dialog = page.locator(".ios-modal");
    await dialog.locator('button:has-text("提交报销")').click();
    await page.waitForTimeout(500);

    // 使用文本匹配定位错误信息
    const errorText = dialog.locator("text=费用说明必填");
    await expect(errorText).toBeVisible({ timeout: 3000 });
  });

  test("表单校验：发票未上传时提示上传", async ({ page }) => {
    await page.goto(`${BASE_URL}/finance/expense`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("费用报销")').click();
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("新增报销")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator("h2:has-text('新增费用报销')")).toBeVisible({ timeout: 5000 });

    const dialog = page.locator(".ios-modal");

    await dialog.locator('input[placeholder="费用说明"]').fill("测试-无发票提交");
    await dialog.locator('input[placeholder="金额"]').fill("500");
    await dialog.locator("select").first().selectOption("办公用品");

    await dialog.locator('button:has-text("提交报销")').click();
    await page.waitForTimeout(500);

    await expect(dialog.locator("text=请上传发票")).toBeVisible({ timeout: 3000 });
  });

  test("应支持添加多行报销明细", async ({ page }) => {
    await page.goto(`${BASE_URL}/finance/expense`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("费用报销")').click();
    await page.waitForTimeout(1000);

    await page.locator('button:has-text("新增报销")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator("h2:has-text('新增费用报销')")).toBeVisible({ timeout: 5000 });

    const dialog = page.locator(".ios-modal");

    await dialog.locator('button:has-text("添加行")').click();
    await page.waitForTimeout(500);

    const descInputs = dialog.locator('input[placeholder="费用说明"]');
    await descInputs.nth(0).fill("交通费用");
    const amountInputs = dialog.locator('input[placeholder="金额"]');
    await amountInputs.nth(0).fill("300");
    await dialog.locator("select").nth(0).selectOption("交通费");

    const fc1Promise = page.waitForEvent("filechooser", { timeout: 10000 });
    const uploadResp1 = page.waitForResponse(
      (resp) => resp.url().includes("/api/upload") && resp.status() === 200,
      { timeout: 15000 }
    );
    await dialog.locator('button:has-text("上传")').nth(0).click();
    const fc1 = await fc1Promise;
    await fc1.setFiles({
      name: "invoice-1.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(
        "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de",
        "hex"
      ),
    });
    await uploadResp1;
    await page.waitForTimeout(500);

    await descInputs.nth(1).fill("办公用品采购");
    await amountInputs.nth(1).fill("200.50");
    await dialog.locator("select").nth(1).selectOption("办公用品");

    const fc2Promise = page.waitForEvent("filechooser", { timeout: 10000 });
    const uploadResp2 = page.waitForResponse(
      (resp) => resp.url().includes("/api/upload") && resp.status() === 200,
      { timeout: 15000 }
    );
    await dialog.locator('button:has-text("上传")').nth(1).click();
    const fc2 = await fc2Promise;
    await fc2.setFiles({
      name: "invoice-2.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(
        "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de",
        "hex"
      ),
    });
    await uploadResp2;
    await page.waitForTimeout(500);

    await expect(dialog.locator("text=500.50")).toBeVisible({ timeout: 3000 });

    await dialog.locator('button:has-text("提交报销")').click();
    await page.waitForTimeout(3000);

    await expect(
      page.locator("table tbody tr:has(td:text('系统管理员'))").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/api/auth/logout`).catch(() => {});
    await page.waitForTimeout(500);
  });
});
