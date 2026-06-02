import * as fs from "fs";
import * as path from "path";

interface TestFailure {
  file: string;
  testName: string;
  errorMessage: string;
  module?: string;
  priority?: "高" | "中" | "低";
}

export class TestReportCollector {
  private failures: TestFailure[] = [];
  private passedCount = 0;
  private failedCount = 0;
  private skippedCount = 0;
  private startTime: number = Date.now();

  addPassed() {
    this.passedCount++;
  }

  addFailed(failure: TestFailure) {
    this.failedCount++;
    this.failures.push(failure);
  }

  addSkipped() {
    this.skippedCount++;
  }

  getFailures(): TestFailure[] {
    return this.failures;
  }

  getSummary(): string {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
    return `
## 测试执行摘要

| 指标 | 数值 |
|------|------|
| 通过 | ${this.passedCount} |
| 失败 | ${this.failedCount} |
| 跳过 | ${this.skippedCount} |
| 总耗时 | ${duration}s |
`;
  }

  generateReport(outputDir: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(outputDir, `test-report-${timestamp}.md`);

    let report = `# 全系统自动化测试报告

**生成时间**: ${new Date().toLocaleString("zh-CN")}
`;

    report += this.getSummary();

    if (this.failures.length > 0) {
      report += `
## 问题详情

| # | 模块 | 测试文件 | 测试用例 | 错误信息 | 优先级 |
|---|------|----------|----------|----------|--------|
`;
      this.failures.forEach((f, i) => {
        const module = f.module || "未知";
        const priority = f.priority || "中";
        report += `| ${i + 1} | ${module} | ${f.file} | ${f.testName} | ${f.errorMessage.replace(/\|/g, "\\|").replace(/\n/g, " ")} | ${priority} |\n`;
      });

      report += `
## 修复计划

`;

      const highPriority = this.failures.filter(f => f.priority === "高");
      const midPriority = this.failures.filter(f => f.priority === "中");
      const lowPriority = this.failures.filter(f => f.priority === "低");

      if (highPriority.length > 0) {
        report += `### 高优先级（阻塞性缺陷）

`;
        highPriority.forEach((f, i) => {
          report += `${i + 1}. **${f.module} - ${f.testName}**: ${f.errorMessage}\n`;
          report += `   - 文件: \`${f.file}\`\n`;
          report += `   - 建议: 立即修复，影响核心业务流程\n\n`;
        });
      }

      if (midPriority.length > 0) {
        report += `### 中优先级（功能性缺陷）

`;
        midPriority.forEach((f, i) => {
          report += `${i + 1}. **${f.module} - ${f.testName}**: ${f.errorMessage}\n`;
          report += `   - 文件: \`${f.file}\`\n`;
          report += `   - 建议: 纳入当前迭代修复\n\n`;
        });
      }

      if (lowPriority.length > 0) {
        report += `### 低优先级（优化建议）

`;
        lowPriority.forEach((f, i) => {
          report += `${i + 1}. **${f.module} - ${f.testName}**: ${f.errorMessage}\n`;
          report += `   - 文件: \`${f.file}\`\n`;
          report += `   - 建议: 可列入后续迭代\n\n`;
        });
      }
    } else {
      report += `
## 结果

✅ **所有测试全部通过！** 未发现任何问题。
`;
    }

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(reportPath, report, "utf-8");
    console.log(`\n📄 测试报告已生成: ${reportPath}`);
    return reportPath;
  }
}

export const reportCollector = new TestReportCollector();
