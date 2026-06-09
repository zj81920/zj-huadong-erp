import OSS from "ali-oss";

type OSSClient = OSS;

let ossClient: OSSClient | null = null;

export function getOSSClient(): OSSClient {
  if (ossClient) return ossClient;

  const region = process.env.OSS_REGION;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  const bucket = process.env.OSS_BUCKET;

  if (!region || !accessKeyId || !accessKeySecret || !bucket) {
    throw new Error(
      "缺少 OSS 环境变量，请检查 OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET"
    );
  }

  ossClient = new OSS({
    region,
    accessKeyId,
    accessKeySecret,
    bucket,
    secure: true,
    authorizationV4: true,
  });

  return ossClient;
}

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
};

export async function uploadToOSS(
  file: Buffer,
  fileName: string,
  folder: string = "uploads"
): Promise<{ url: string; key: string }> {
  const client = getOSSClient();
  const key = `${folder}/${Date.now()}-${fileName}`;
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';
  const contentType = MIME_MAP[ext] || 'application/octet-stream';

  const result = await client.put(key, file, {
    headers: {
      "Content-Disposition": "inline",
      "Content-Type": contentType,
    },
  });

  return {
    url: result.url,
    key: result.name,
  };
}

export async function deleteFromOSS(key: string): Promise<void> {
  const client = getOSSClient();
  await client.delete(key);
}

// 检查 OSS 文件是否存在
export async function ossFileExists(key: string): Promise<boolean> {
  const client = getOSSClient();
  try {
    await client.head(key);
    return true;
  } catch (e: any) {
    if (e.code === 'NoSuchKey' || e.status === 404) return false;
    throw e;
  }
}

export function getSignedUrl(key: string, expires: number = 3600): string {
  const client = getOSSClient();
  return client.signatureUrl(key, {
    expires,
    response: {
      'content-disposition': 'inline',
    },
  });
}

export interface OSSSearchResult {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  score?: number;
}

export async function searchFiles(
  query: string,
  maxResults: number = 20
): Promise<OSSSearchResult[]> {
  const client = getOSSClient();
  const bucket = process.env.OSS_BUCKET!;

  const xmlBody = `<MetaQuery>
  <Mode>semantic</Mode>
  <Query>${escapeXml(query)}</Query>
  <MaxResults>${maxResults}</MaxResults>
</MetaQuery>`;

  const result = await (client as any).request({
    method: "POST",
    bucket,
    subres: "metaQuery",
    content: xmlBody,
    headers: { "Content-Type": "application/xml" },
    timeout: 30000,
    successStatuses: [200],
  });

  return parseSearchResponse(result.data?.toString() || "");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseSearchResponse(xml: string): OSSSearchResult[] {
  const results: OSSSearchResult[] = [];
  const objectRegex = /<Object>([\s\S]*?)<\/Object>/g;
  let match: RegExpExecArray | null;

  while ((match = objectRegex.exec(xml)) !== null) {
    const block = match[1];
    const getTag = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      return m ? m[1].trim() : "";
    };

    results.push({
      key: getTag("Key"),
      name: getTag("Key").split("/").pop() || getTag("Key"),
      size: parseInt(getTag("Size"), 10) || 0,
      lastModified: getTag("LastModified"),
      score: parseFloat(getTag("Score")) || undefined,
    });
  }

  return results;
}

export function isOSSConfigured(): boolean {
  return !!(
    process.env.OSS_REGION &&
    process.env.OSS_ACCESS_KEY_ID &&
    process.env.OSS_ACCESS_KEY_SECRET &&
    process.env.OSS_BUCKET
  );
}
