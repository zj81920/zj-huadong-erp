import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAIConfig, callAIModel } from '@/lib/ai';

const SYSTEM_PROMPT_PARSE = `你是一个 ERP 财务数据分析助手。你的任务是解析用户的财务查询需求，输出结构化的查询计划。

支持的可查询维度：
- 时间范围（近N个月、Q1、今年等）
- 数据类型：收入合同(IncomeContract)、支出合同(ExpenseContract)、应收款(Receivable)、应付款(Payable)、收款凭证(ReceiptVoucher)、付款凭证(PaymentVoucher)、工资(SalaryPayment)、借入款(OtherBorrowing)、借出款(LendingOut)、项目(Project)
- 聚合方式：按分类汇总、按时间趋势、按项目分组
- 图表类型：bar（柱状图）、pie（饼图）、line（折线图）

仅输出 JSON：
{
  "tables": ["Receivable"],
  "filters": { "dateField": "dueDate", "months": 3 },
  "groupBy": "customer",
  "chartType": "bar"
}`;

const SYSTEM_PROMPT_ANALYZE = `你是一个 ERP 财务数据分析专家。根据查询到的数据，生成结构化的分析报告。

输出格式必须是严格的 JSON：
{
  "analysis": "一行核心结论",
  "paragraphs": ["详细分析段落1", "详细分析段落2"],
  "chart": {
    "type": "bar|pie|line",
    "title": "图表标题",
    "data": [{ "name": "分类名", "value": 数字金额 }],
    "xField": "name",
    "yField": "value"
  },
  "cards": [
    { "label": "指标名", "value": "金额或百分比", "color": "red|green|blue|amber|purple" }
  ],
  "table": {
    "title": "明细表标题",
    "columns": ["列1", "列2"],
    "rows": [["值1", "值2"]]
  }
}

规则：
1. analysis 是一句话核心结论
2. paragraphs 是 2-4 段详细分析
3. chart 可选，type 必须是 bar/pie/line 之一
4. cards 可选，建议 3-4 个关键指标
5. table 可选，展示明细数据
6. 金额用 ¥ 前缀，带千分位逗号
7. 确保输出的 JSON 是合法的，不要用 markdown 代码块包裹`;

export async function POST(request: NextRequest) {
  try {
    const config = await getAIConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'AI 模型未配置，请在系统设置中配置模型参数' },
        { status: 400 }
      );
    }

    const { query } = await request.json();
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: '请输入查询内容' }, { status: 400 });
    }

    // Step 1: AI 解析用户问题 → 查询计划
    const parseMessages = [
      { role: 'system', content: SYSTEM_PROMPT_PARSE },
      { role: 'user', content: `用户问题：${query}` },
    ];
    const parseResult = await callAIModel(parseMessages, config);
    let plan: any;
    try {
      plan = JSON.parse(parseResult);
    } catch {
      return NextResponse.json({ error: 'AI 解析失败，请换个问题试试' }, { status: 500 });
    }

    // Step 2: Prisma 查库
    const dbData = await queryDatabase(plan);

    // Step 3: AI 分析数据 → 结构化 JSON
    const analyzeMessages = [
      { role: 'system', content: SYSTEM_PROMPT_ANALYZE },
      { role: 'user', content: `查询计划：${JSON.stringify(plan)}\n\n查询结果：${JSON.stringify(dbData)}` },
    ];
    const analyzeResult = await callAIModel(analyzeMessages, config);

    // 解析 AI 输出的 JSON
    let response: any;
    try {
      const cleaned = analyzeResult
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      response = JSON.parse(cleaned);
    } catch {
      // 如果 JSON 解析失败，返回原始文本
      return NextResponse.json({
        analysis: '分析完成',
        paragraphs: [analyzeResult],
      });
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('AI 财务查询失败:', error);
    return NextResponse.json(
      { error: error.message || '查询失败，请稍后重试' },
      { status: 500 }
    );
  }
}

async function queryDatabase(plan: any): Promise<any> {
  const tables = plan?.tables || ['Receivable'];
  const result: Record<string, any> = {};

  for (const table of tables) {
    try {
      switch (table) {
        case 'Receivable':
          result.receivables = await prisma.receivable.findMany({
            take: 500,
            orderBy: { dueDate: 'desc' },
            include: { project: true },
          });
          break;
        case 'Payable':
          result.payables = await prisma.payable.findMany({
            take: 500,
            orderBy: { dueDate: 'desc' },
          });
          break;
        case 'IncomeContract':
          result.incomeContracts = await prisma.incomeContract.findMany({
            take: 500,
            orderBy: { signedDate: 'desc' },
            include: { project: true },
          });
          break;
        case 'ExpenseContract':
          result.expenseContracts = await prisma.expenseContract.findMany({
            take: 500,
            orderBy: { signedDate: 'desc' },
            include: { project: true },
          });
          break;
        case 'ReceiptVoucher':
          result.receiptVouchers = await prisma.receiptVoucher.findMany({
            take: 500,
            orderBy: { receiptDate: 'desc' },
          });
          break;
        case 'PaymentVoucher':
          result.paymentVouchers = await prisma.paymentVoucher.findMany({
            take: 500,
            orderBy: { paymentDate: 'desc' },
          });
          break;
        case 'SalaryPayment':
          result.salaryPayments = await prisma.salaryPayment.findMany({
            take: 500,
            orderBy: { period: 'desc' },
          });
          break;
        case 'Project':
          result.projects = await prisma.project.findMany({ take: 200 });
          break;
        case 'OtherBorrowing':
          result.otherBorrowings = await prisma.otherBorrowing.findMany({ take: 200 });
          break;
        case 'LendingOut':
          result.lendingOuts = await prisma.lendingOut.findMany({ take: 200 });
          break;
        default:
          break;
      }
    } catch (e) {
      console.error(`查询 ${table} 失败:`, e);
    }
  }

  return result;
}
