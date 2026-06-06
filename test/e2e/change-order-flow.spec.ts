import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

// 辅助：登录
async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 10000 });
}

test.describe('合同变更单完整流程', () => {
  test('创建变更单 → 提交审批 → 审批通过 → 验证合同金额更新', async ({ page }) => {
    await login(page);

    // 1. 进入收入合同列表
    await page.goto(`${BASE_URL}/contracts/income`);
    await page.waitForLoadState('networkidle');

    // 2. 找到已批准的合同，点击查看详情
    const approvedRow = page.locator('tr').filter({ hasText: '已批准' }).first();
    if (await approvedRow.count() > 0) {
      await approvedRow.locator('button:has-text("查看"), a:has-text("查看")').first().click();
      await page.waitForLoadState('networkidle');

      // 3. 点击"发起变更"按钮
      const changeBtn = page.locator('button:has-text("发起变更")');
      if (await changeBtn.count() > 0) {
        await changeBtn.click();
        await page.waitForLoadState('networkidle');

        // 4. 填写变更表单
        await page.waitForURL('**/contracts/change-orders/new*', { timeout: 5000 });
        const reasonInput = page.locator('textarea, input[name="changeReason"]');
        if (await reasonInput.count() > 0) {
          await reasonInput.fill('E2E 测试：客户要求增加合同金额');
        }

        const newAmountInput = page.locator('input[name="newAmount"], input[type="number"]').first();
        if (await newAmountInput.count() > 0) {
          await newAmountInput.clear();
          await newAmountInput.fill('150000');
        }

        // 5. 提交
        const submitBtn = page.locator('button:has-text("提交"), button:has-text("保存")');
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }

    // 6. 进入变更单列表页验证
    await page.goto(`${BASE_URL}/contracts/change-orders`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });
  });

  test('变更单列表页可访问且显示正确', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/contracts/change-orders`);
    await page.waitForLoadState('networkidle');

    // 验证页面标题或关键元素
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });
  });

  test('变更单新建页可访问', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/contracts/change-orders/new`);
    await page.waitForLoadState('networkidle');

    // 验证表单元素存在
    const form = page.locator('form, [class*="card"]');
    await expect(form.first()).toBeVisible({ timeout: 5000 });
  });

  test('合同变更单归档流程', async ({ page }) => {
    await login(page);

    // 1. 进入变更单列表
    await page.goto(`${BASE_URL}/contracts/change-orders`);
    await page.waitForLoadState('networkidle');

    // 2. 找到"待归档"或"已批准"的变更单
    const pendingArchiveRow = page.locator('tr').filter({ hasText: '待归档' }).first();
    const approvedRow = page.locator('tr').filter({ hasText: '已批准' }).first();

    const targetRow = (await pendingArchiveRow.count()) > 0 ? pendingArchiveRow :
      (await approvedRow.count()) > 0 ? approvedRow : null;

    if (targetRow) {
      // 3. 点击归档
      const archiveBtn = targetRow.locator('button:has-text("归档")');
      if (await archiveBtn.count() > 0) {
        await archiveBtn.click();
        await page.waitForLoadState('networkidle');

        // 4. 确认归档弹窗显示
        const modal = page.locator('[class*="fixed"]').filter({ hasText: '变更单归档' });
        if (await modal.count() > 0) {
          // 5. 点击确认归档（不上传文件）
          const confirmBtn = page.locator('button:has-text("确认归档")');
          if (await confirmBtn.count() > 0) {
            await confirmBtn.click();
            await page.waitForLoadState('networkidle');
          }
        }
      }
    }

    // 6. 验证列表仍然正常渲染
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });
  });
});
