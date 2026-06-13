import { describe, it, expect } from 'vitest';
import { isValidChartConfig, isValidCard, isValidFinanceResponse, formatAmount } from '@/lib/ai-finance-utils';

describe('isValidChartConfig', () => {
  it('should accept valid bar chart config', () => {
    const config = {
      type: 'bar' as const,
      title: 'test',
      data: [{ name: 'a', value: 100 }],
      xField: 'name',
      yField: 'value',
      color: '#3b82f6',
    };
    expect(isValidChartConfig(config)).toBe(true);
  });

  it('should accept valid pie chart config', () => {
    const config = {
      type: 'pie' as const,
      title: 'test',
      data: [{ name: 'a', value: 100 }],
      nameField: 'name',
      valueField: 'value',
      colors: ['#10b981'],
    };
    expect(isValidChartConfig(config)).toBe(true);
  });

  it('should accept valid line chart config', () => {
    const config = {
      type: 'line' as const,
      title: 'test',
      data: [{ month: 'Jan', income: 100 }],
      xField: 'month',
      lines: [{ dataKey: 'income', color: '#34C759', strokeWidth: 2 }],
    };
    expect(isValidChartConfig(config)).toBe(true);
  });

  it('should reject config with invalid type', () => {
    const config = { type: 'scatter', title: 'test', data: [], xField: 'x' };
    expect(isValidChartConfig(config)).toBe(false);
  });

  it('should reject bar chart missing yField', () => {
    const config = { type: 'bar', title: 'test', data: [], xField: 'x' };
    expect(isValidChartConfig(config)).toBe(false);
  });

  it('should reject pie chart missing nameField', () => {
    const config = { type: 'pie', title: 'test', data: [], valueField: 'v' };
    expect(isValidChartConfig(config)).toBe(false);
  });

  it('should reject empty data array', () => {
    const config = { type: 'bar', title: 'test', data: [], xField: 'x', yField: 'y' };
    expect(isValidChartConfig(config)).toBe(false);
  });
});

describe('isValidCard', () => {
  it('should accept valid card', () => {
    expect(isValidCard({ label: '总支出', value: '¥100', color: 'red' })).toBe(true);
  });

  it('should accept card with change field', () => {
    expect(isValidCard({ label: '收入', value: '¥200', color: 'green', change: 'up' })).toBe(true);
  });

  it('should reject card with invalid color', () => {
    expect(isValidCard({ label: 'x', value: 'y', color: 'pink' })).toBe(false);
  });

  it('should reject card with invalid change', () => {
    expect(isValidCard({ label: 'x', value: 'y', color: 'red', change: 'sideways' })).toBe(false);
  });

  it('should reject card missing label', () => {
    expect(isValidCard({ value: 'y', color: 'red' })).toBe(false);
  });
});

describe('isValidFinanceResponse', () => {
  it('should accept minimal valid response (analysis only)', () => {
    const resp = { analysis: 'test', paragraphs: ['detail'] };
    expect(isValidFinanceResponse(resp)).toBe(true);
  });

  it('should accept full response with chart, cards, table', () => {
    const resp = {
      analysis: 'test',
      paragraphs: ['detail'],
      chart: { type: 'bar', title: 't', data: [{ n: 'a', v: 1 }], xField: 'n', yField: 'v' },
      cards: [{ label: 'l', value: 'v', color: 'red' as const }],
      table: { title: 't', columns: ['c1'], rows: [['v1']] },
    };
    expect(isValidFinanceResponse(resp)).toBe(true);
  });

  it('should reject response with invalid optional chart', () => {
    const resp = {
      analysis: 'test',
      paragraphs: [],
      chart: { type: 'bar', title: 't', data: [], xField: 'x' },
    };
    expect(isValidFinanceResponse(resp)).toBe(false);
  });

  it('should reject response with invalid cards', () => {
    const resp = {
      analysis: 'test',
      paragraphs: [],
      cards: [{ label: 'x', value: 'y', color: 'pink' }],
    };
    expect(isValidFinanceResponse(resp)).toBe(false);
  });
});

describe('formatAmount', () => {
  it('should format number with ¥ prefix and commas', () => {
    expect(formatAmount(1234567)).toBe('¥1,234,567');
  });

  it('should handle zero', () => {
    expect(formatAmount(0)).toBe('¥0');
  });

  it('should handle decimals', () => {
    expect(formatAmount(1234.5)).toBe('¥1,234.5');
  });

  it('should handle string number input', () => {
    expect(formatAmount('500000')).toBe('¥500,000');
  });

  it('should return empty string for null/undefined', () => {
    expect(formatAmount(null)).toBe('');
    expect(formatAmount(undefined)).toBe('');
  });
});
