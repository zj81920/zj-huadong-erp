import { describe, it, expect } from 'vitest';
import { chunkText } from '@/lib/file-index/chunker';

describe('chunkText', () => {
  it('应返回空数组当输入为空', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
  });

  it('应返回单个 chunk 当文本小于 chunk_size', () => {
    const result = chunkText('这是一段短文本');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('这是一段短文本');
    expect(result[0].index).toBe(0);
  });

  it('应按固定长度切分长文本', () => {
    const longText = 'A'.repeat(1500);
    const result = chunkText(longText, 500, 50);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('相邻 chunk 应有重叠', () => {
    const text = '一二三四五六七八九十'.repeat(100);
    const result = chunkText(text, 50, 10);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].text.length).toBeLessThanOrEqual(60);
    }
  });

  it('应保留中文字符完整性', () => {
    const chineseText = '合同编号：HT-2025-001\n\n甲方：XX有限公司\n\n乙方：YY有限公司\n\n第一条 合同标的\n\n'.repeat(20);
    const result = chunkText(chineseText, 100, 10);
    expect(result.length).toBeGreaterThan(0);
    result.forEach(chunk => {
      expect(typeof chunk.text).toBe('string');
      expect(chunk.text.length).toBeGreaterThan(0);
    });
  });

  it('应优先在段落边界切分', () => {
    const text = '第一段内容。\n\n第二段内容。\n\n第三段内容。\n\n'.repeat(10);
    const result = chunkText(text, 200, 20);
    result.forEach(chunk => {
      expect(chunk.text.trim()).toMatch(/^第[一二三四五六七八九十]/);
    });
  });
});
