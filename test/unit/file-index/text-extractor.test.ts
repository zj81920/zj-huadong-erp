import { describe, it, expect } from 'vitest';
import { extractText } from '@/lib/file-index/text-extractor';
import fs from 'fs';

describe('extractText', () => {
  it('应提取 txt 文件内容', async () => {
    const tmpFile = '/tmp/test-extractor.txt';
    fs.writeFileSync(tmpFile, 'Hello World 测试');
    const result = await extractText(tmpFile, 'text/plain');
    expect(result).toContain('Hello World');
    fs.unlinkSync(tmpFile);
  });

  it('应返回空字符串对不支持的文件类型', async () => {
    const result = await extractText('/tmp/test-extractor.zip', 'application/zip');
    expect(result).toBe('');
  });

  it('应对不存在的文件返回空字符串', async () => {
    const result = await extractText('/tmp/nonexist.pdf', 'application/pdf');
    expect(result).toBe('');
  });
});
