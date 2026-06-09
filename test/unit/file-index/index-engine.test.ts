import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    fileIndexRecord: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    fileChunk: { createMany: vi.fn(), deleteMany: vi.fn() },
    $executeRaw: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

vi.mock('@/lib/file-index/text-extractor', () => ({
  extractText: vi.fn(),
  getSupportMimeTypes: vi.fn().mockReturnValue(['text/plain', 'application/pdf']),
}));

vi.mock('@/lib/file-index/chunker', () => ({ chunkText: vi.fn() }));
vi.mock('@/lib/ai', () => ({ getEmbeddings: vi.fn() }));
vi.mock('@/lib/oss', () => ({ getOSSClient: vi.fn(() => ({ get: vi.fn() })) }));

import { indexFile, indexFileFromOSS, indexAllPending } from '@/lib/file-index/index-engine';

describe('indexFile', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('应处理文本文件并创建索引记录', async () => {
    const { extractText } = await import('@/lib/file-index/text-extractor');
    const { chunkText } = await import('@/lib/file-index/chunker');
    const { getEmbeddings } = await import('@/lib/ai');

    (extractText as any).mockResolvedValue('测试内容');
    (chunkText as any).mockReturnValue([{ text: '测试内容', index: 0 }]);
    (getEmbeddings as any).mockResolvedValue([[0.1, 0.2, 0.3]]);
    mockPrisma.fileIndexRecord.create.mockResolvedValue({ id: 'rec-1' });

    const result = await indexFile('/tmp/test.txt', 'text/plain', '测试.txt');

    expect(mockPrisma.fileIndexRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fileName: '测试.txt', status: 'processing' }),
      })
    );
    expect(result).toBe('rec-1');
  });

  it('应抛出错误对不支持的文件类型', async () => {
    await expect(indexFile('/tmp/test.zip', 'application/zip', 'test.zip'))
      .rejects.toThrow('不支持的文件类型');
  });

  it('应在提取失败时更新状态为 failed', async () => {
    const { extractText } = await import('@/lib/file-index/text-extractor');
    (extractText as any).mockRejectedValue(new Error('提取失败'));
    mockPrisma.fileIndexRecord.create.mockResolvedValue({ id: 'rec-2' });

    await expect(indexFile('/tmp/test.txt', 'text/plain', 'test.txt')).rejects.toThrow();
    expect(mockPrisma.fileIndexRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rec-2' },
        data: expect.objectContaining({ status: 'failed' }),
      })
    );
  });
});
