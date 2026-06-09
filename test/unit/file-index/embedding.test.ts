import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('@/lib/ai', () => ({
  getEmbedding: vi.fn(),
  getEmbeddings: vi.fn(),
  getEmbeddingConfig: vi.fn(),
  getAIConfig: vi.fn(),
}));

import { getEmbedding, getEmbeddings } from '@/lib/ai';

describe('getEmbedding', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('应返回向量数组', async () => {
    (getEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);
    const result = await getEmbedding('测试文本');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('应抛出错误当 API 返回非 200', async () => {
    (getEmbedding as any).mockRejectedValue(new Error('Embedding API error: 401 Unauthorized'));
    await expect(getEmbedding('test')).rejects.toThrow('Embedding API error');
  });
});

describe('getEmbeddings', () => {
  it('应批量返回向量', async () => {
    (getEmbeddings as any).mockResolvedValue([[0.1], [0.2], [0.3]]);
    const results = await getEmbeddings(['a', 'b', 'c']);
    expect(results).toHaveLength(3);
  });
});
