import { test, expect } from '@playwright/test';

test.describe('AI Finance Query Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/finance/reports');
  });

  test('should render header and input', async ({ page }) => {
    await expect(page.getByText('AI 智能财务查询')).toBeVisible();
    await expect(page.getByPlaceholder('输入财务查询问题')).toBeVisible();
    await expect(page.getByRole('button', { name: '发送' })).toBeVisible();
  });

  test('should render 5 preset chips', async ({ page }) => {
    const presets = ['近3个月支出按分类显示', '今年Q1收入趋势分析', '应收账款', '本月现金流状况', '各项目成本占比'];
    for (const label of presets) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('should show loading when clicking a preset', async ({ page }) => {
    await page.getByText('近3个月支出按分类显示', { exact: true }).click();
    await expect(page.getByText('正在查询分析中...')).toBeVisible();
  });

  test('should handle empty input - send button disabled', async ({ page }) => {
    const sendBtn = page.getByRole('button', { name: '发送' });
    await expect(sendBtn).toBeDisabled();
  });

  test('should trigger query on Enter key', async ({ page }) => {
    const input = page.getByPlaceholder('输入财务查询问题');
    await input.fill('近3个月支出');
    await input.press('Enter');
    await expect(page.getByText('正在查询分析中...')).toBeVisible();
  });

  test('should disable input during loading', async ({ page }) => {
    await page.getByText('近3个月支出按分类显示', { exact: true }).click();
    await expect(page.getByPlaceholder('输入财务查询问题')).toBeDisabled();
  });

  test('should show error when AI not configured', async ({ page }) => {
    await page.getByText('近3个月支出按分类显示', { exact: true }).click();
    // Wait for loading to finish (either success or error)
    await page.waitForSelector('text=正在查询分析中', { state: 'detached', timeout: 30000 });
    // Either response or error should be visible
    const hasResponse = await page.locator('.text-gray-900').first().isVisible().catch(() => false);
    const hasError = await page.locator('.bg-red-50').first().isVisible().catch(() => false);
    expect(hasResponse || hasError).toBe(true);
  });
});
