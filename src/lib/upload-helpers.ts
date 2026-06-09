/**
 * 根据上传返回的 URL 删除对应的 OSS 文件和向量索引记录。
 * url 可以是 OSS 完整 URL 或本地路径。
 */
export async function deleteUploadedFile(url: string): Promise<boolean> {
  try {
    const key = extractFileKey(url);
    const res = await fetch(`/api/file/index/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 从 URL 提取 fileKey */
function extractFileKey(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // OSS URL: https://bucket.oss-cn-hangzhou.aliyuncs.com/uploads/xxx.pdf
    // → key: uploads/xxx.pdf
    const pathname = new URL(url).pathname;
    return pathname.startsWith('/') ? pathname.slice(1) : pathname;
  }
  // 本地路径: /uploads/xxx.pdf → 直接用
  return url;
}
