import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDeleteFromOSS, mockPrismaDelete } = vi.hoisted(() => ({
  mockDeleteFromOSS: vi.fn(),
  mockPrismaDelete: vi.fn(),
}));

vi.mock('@/lib/oss', () => ({ deleteFromOSS: mockDeleteFromOSS }));

vi.mock('@/lib/prisma', () => ({
  default: { fileIndexRecord: { delete: mockPrismaDelete } },
}));

import { cleanupFileRecord, cleanupFileByKey } from '@/lib/file-index/cleanup';

describe('cleanupFileRecord', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('应删除 OSS 文件和数据库记录', async () => {
    mockPrismaDelete.mockResolvedValue({ fileKey: 'uploads/test.pdf' });
    await cleanupFileRecord('rec-1');
    expect(mockDeleteFromOSS).toHaveBeenCalledWith('uploads/test.pdf');
    expect(mockPrismaDelete).toHaveBeenCalledWith({ where: { id: 'rec-1' }, select: { fileKey: true } });
  });

  it('应在 OSS 删除失败时不影响主流程', async () => {
    mockDeleteFromOSS.mockRejectedValue(new Error('OSS error'));
    mockPrismaDelete.mockResolvedValue({ fileKey: 'uploads/test.pdf' });
    await expect(cleanupFileRecord('rec-1')).resolves.not.toThrow();
  });
});

describe('cleanupFileByKey', () => {
  it('应通过 fileKey 删除', async () => {
    mockPrismaDelete.mockResolvedValue({});
    await cleanupFileByKey('uploads/test.pdf');
    expect(mockDeleteFromOSS).toHaveBeenCalledWith('uploads/test.pdf');
  });
});
