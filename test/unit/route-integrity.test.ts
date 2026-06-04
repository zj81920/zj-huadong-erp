/**
 * 前端页面路由完整性检查测试
 *
 * 验证规则：
 * 1. 侧边栏所有菜单项的 href 路径都有对应的 page.tsx
 * 2. 页面中所有 Link href / router.push 目标都有对应的 page.tsx
 * 3. 各功能模块具备完整的页面清单（列表页、新增页、详情页/编辑页）
 *
 * 运行方式：npx vitest run test/unit/route-integrity.test.ts
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const APP_DIR = path.join(PROJECT_ROOT, 'src/app');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

// ============================================================
// 辅助函数
// ============================================================

/** 获取所有 page.tsx 对应的路由路径（不含路由组前缀） */
function getAllPageRoutes(): string[] {
  const pages: string[] = [];

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === 'page.tsx') {
        const relativePath = path.relative(APP_DIR, fullPath);
        // 分割路径，过滤掉路由组目录（如 (dashboard)），然后拼接
        const segments = relativePath.split('/').filter((s) => !/^\(.+\)$/.test(s));
        // 移除 page.tsx
        segments.pop();
        // 组装路由路径
        let route = '/' + segments.join('/');
        // 根路由特例
        if (route === '/') route = '/';
        pages.push(route);
      }
    }
  }

  walk(APP_DIR);
  return [...new Set(pages)];
}

/** 从 Sidebar.tsx 提取所有菜单 href */
function getSidebarHrefs(): string[] {
  const filePath = path.join(SRC_DIR, 'components/Sidebar.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  const hrefs: string[] = [];
  const regex = /href:\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    hrefs.push(match[1]);
  }
  return [...new Set(hrefs)];
}

/** 从 Header.tsx 提取所有 Link href */
function getHeaderHrefs(): string[] {
  const filePath = path.join(SRC_DIR, 'components/Header.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  const hrefs: string[] = [];
  const regex = /href=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    hrefs.push(match[1]);
  }
  return [...new Set(hrefs)];
}

/** 从指定页面文件中提取 Link href 和 router.push 目标 */
function extractLinksFromFile(filePath: string): string[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }
  const links: string[] = [];

  // 匹配 <Link href="...">
  const linkRegex = /href=["']([^"']+?)["']/g;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[1]);
  }

  // 匹配 router.push("...") 或 router.push('...')
  const pushRegex = /router\.push\(["']([^"']+?)["']\)/g;
  while ((match = pushRegex.exec(content)) !== null) {
    links.push(match[1]);
  }

  // 匹配 router.push(`...${...}`) — 跳过含模板变量的动态路径
  const templatePushRegex = /router\.push\(`([^`]*\$\{[^}]+}[^`]*)`\)/g;
  while ((match = templatePushRegex.exec(content)) !== null) {
    // 不做精确匹配，但记录其静态前缀用于感知
    // 这里我们只是确认存在动态跳转，不报错
    void match;
  }

  return [...new Set(links)];
}

/** 去除 query 参数，获取基础路径 */
function stripQuery(url: string): string {
  return url.split('?')[0];
}

/** 判断是否为外部链接 */
function isExternalLink(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:');
}

/** 判断是否为锚点链接 */
function isAnchorLink(href: string): boolean {
  return href.startsWith('#');
}

// ============================================================
// 测试用例
// ============================================================

describe('前端页面路由完整性检查', () => {
  const pageRoutes = getAllPageRoutes();

  it('侧边栏所有菜单项都有对应的 page.tsx 文件', () => {
    const sidebarHrefs = getSidebarHrefs();
    const missing = sidebarHrefs.filter(
      (href) => !isExternalLink(href) && !isAnchorLink(href) && !pageRoutes.includes(href)
    );

    expect(missing, [
      '以下侧边栏菜单项缺少对应的 page.tsx 文件：',
      ...missing.map((h) => `  ❌ ${h}`),
      '',
      '请检查：src/app/ 下是否存在对应的目录和 page.tsx',
    ].join('\n')).toEqual([]);
  });

  it('Header 中所有 Link 跳转目标都有对应的 page.tsx 文件', () => {
    const headerHrefs = getHeaderHrefs();
    const missing = headerHrefs.filter((href) => {
      if (isExternalLink(href) || isAnchorLink(href)) return false;
      const basePath = stripQuery(href);
      return !pageRoutes.includes(basePath);
    });

    expect(missing, [
      '以下 Header Link 缺少对应的 page.tsx 文件：',
      ...missing.map((h) => `  ❌ ${h}`),
      '',
      '注意：带 query 参数的路由会检查其基础路径（如 /settings/profile?tab=abc → /settings/profile）',
    ].join('\n')).toEqual([]);
  });

  it('各功能模块具备完整的页面清单（列表页、新增页、详情页/编辑页）', () => {
    const modulesToCheck = [
      { name: '内部结算', list: '/contracts/internal-settlement', new: '/contracts/internal-settlement/new', detail: '/contracts/internal-settlement/[id]' },
      { name: '合同变更', list: '/contracts/change-orders', new: '/contracts/change-orders/new', detail: '/contracts/change-orders/[id]' },
      { name: '角色设置', list: '/settings/roles', new: '/settings/roles/new', detail: '/settings/roles/[id]' },
      { name: '市场开发', list: '/business/project-leads', new: null, detail: '/business/project-leads/[id]' },
    ];

    const issues: string[] = [];
    for (const mod of modulesToCheck) {
      if (!pageRoutes.includes(mod.list)) {
        issues.push(`${mod.name}: 缺少列表页 ${mod.list}`);
      }
      if (mod.new && !pageRoutes.includes(mod.new)) {
        issues.push(`${mod.name}: 缺少新增页 ${mod.new}`);
      }
      if (mod.detail && !pageRoutes.includes(mod.detail)) {
        issues.push(`${mod.name}: 缺少详情页 ${mod.detail}`);
      }
    }

    expect(issues, [
      '以下功能模块页面不完整：',
      ...issues.map((i) => `  ❌ ${i}`),
      '',
      '每个功能模块应包含：列表页（page.tsx）、新增页（new/page.tsx）、详情页（[id]/page.tsx）',
    ].join('\n')).toEqual([]);
  });

  it('页面文件中引用的 Link 和 router.push 目标都有对应的 page.tsx', () => {
    // 扫描所有页面文件中的跳转链接
    const pageFiles: string[] = [];
    function walk(dir: string) {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.name === 'page.tsx') {
          pageFiles.push(fullPath);
        }
      }
    }
    walk(APP_DIR);

    const missingSet = new Set<string>();
    const sourceMap = new Map<string, string[]>(); // missing_path → [source_files]

    for (const filePath of pageFiles) {
      const links = extractLinksFromFile(filePath);
      for (const link of links) {
        if (isExternalLink(link) || isAnchorLink(link)) continue;
        const basePath = stripQuery(link);
        // 跳过动态路径片段（如 /settings/${id} 这类拼接待确认）
        if (basePath.includes('${')) continue;
        if (!pageRoutes.includes(basePath)) {
          missingSet.add(link);
          if (!sourceMap.has(link)) sourceMap.set(link, []);
          sourceMap.get(link)!.push(filePath.replace(PROJECT_ROOT, ''));
        }
      }
    }

    const missing = Array.from(missingSet);
    expect(missing, [
      '以下页面文件中引用的跳转目标缺少对应的 page.tsx 文件：',
      ...missing.map((h) => {
        const sources = (sourceMap.get(h) || []).join(', ');
        return `  ❌ ${h} (引用位置: ${sources})`;
      }),
      '',
      '请检查：1) 拼写错误 2) 是否忘记创建目标页面 3) 动态路径是否正确',
    ].join('\n')).toEqual([]);
  });
});
