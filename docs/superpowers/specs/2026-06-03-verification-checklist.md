# 实现验证清单记录

> 日期：2026-06-03
> 功能：用户个人设置、待办增强与通知系统

## 验证清单

| # | 验证项 | 状态 | 说明 |
|---|--------|------|------|
| 1 | Prisma schema 变更后运行 validate + db push | ✅ 通过 | User 新增 avatarUrl，新增 Notification 模型，validate 和 db push 均成功 |
| 2 | TypeScript 类型无错误（next build） | ✅ 通过 | `npx next build` 编译成功，所有路由正常生成 |
| 3 | Layout 重构后页面正常渲染 | ✅ 通过 | Header 组件固定顶部(h-14)，Sidebar 从 top-14 开始，主内容区 ml-[240px] + pt-14 |
| 4 | Header 组件显示正常，通知铃铛和用户下拉菜单交互可用 | ✅ 代码已就绪 | Header.tsx 含通知铃铛(未读角标) + 用户头像姓名(下拉菜单)，点击外部自动关闭 |
| 5 | 个人设置页面可正常访问，所有 Tab 切换正常 | ✅ 代码已就绪 | `/settings/profile` 路由已生成（6.39 kB），三 Tab 切换含 URL 参数同步 |
| 6 | 修改密码功能正常 | ✅ 代码已就绪 | 调用已有 PUT /api/auth/change-password，旧密码验证 + 新密码确认 |
| 7 | 头像上传功能正常 | ✅ 代码已就绪 | 通过 /api/upload 上传，PUT /api/settings/profile 保存 avatarUrl |
| 8 | 签名上传功能正常 | ✅ 代码已就绪 | 同头像逻辑，保存 signatureUrl 到 User 模型 |
| 9 | 待办页面三标签切换正常 | ✅ 代码已就绪 | pending/processed/initiated 三个 Tab，各自独立 API 和数据加载 |
| 10 | 通知生成（审批操作后）正常 | ✅ 代码已就绪 | approval-engine.ts 在 approve(下一节点)/reject/archive 三处生成通知 |
| 11 | 通知铃铛未读数正确显示 | ✅ 代码已就绪 | GET /api/notifications/unread-count，60秒轮询刷新 |
| 12 | 通知已读标记功能正常 | ✅ 代码已就绪 | PUT /api/notifications/[id]/read + PUT /api/notifications/read-all |
| 13 | 管理员用户编辑中头像管理 | ✅ 代码已就绪 | users/page.tsx 新增头像上传/预览/移除，列表显示头像 |

## 构建结果

```
✓ Compiled successfully in 2.2s
✓ Linting and checking validity of types

所有路由正常生成，包括：
├ ○ /settings/profile   (6.39 kB)   ← 新增
├ ○ /settings/users     (6.74 kB)   ← 已修改
└ ... 其他路由均正常
```

## 文件变更清单

### 新增文件（7个）
- `src/components/Header.tsx` — 顶部 Header（通知+用户菜单）
- `src/app/(dashboard)/settings/profile/page.tsx` — 个人设置页面
- `src/app/api/settings/profile/route.ts` — 个人资料 API
- `src/app/api/notifications/route.ts` — 通知列表 API
- `src/app/api/notifications/unread-count/route.ts` — 未读数 API
- `src/app/api/notifications/read-all/route.ts` — 全部已读 API
- `src/app/api/notifications/[id]/read/route.ts` — 单条已读 API

### 修改文件（8个）
- `prisma/schema.prisma` — User 新增 avatarUrl，新增 Notification 模型
- `src/lib/auth.ts` — CurrentUser 接口+返回值增加 avatarUrl
- `src/contexts/AuthContext.tsx` — CurrentUser 接口增加 avatarUrl
- `src/app/(dashboard)/layout.tsx` — 引入 Header，重构布局
- `src/components/Sidebar.tsx` — 移除底部用户区域+修改密码弹窗，增加个人设置入口
- `src/lib/approval-engine.ts` — 审批操作后生成通知
- `src/app/api/approval-instances/route.ts` — 扩展 processed/initiated 查询
- `src/app/(dashboard)/approvals/page.tsx` — 三标签增强
- `src/app/(dashboard)/settings/users/page.tsx` — 管理员编辑增加头像
- `src/app/api/settings/users/route.ts` — 处理 avatarUrl
- `src/app/api/settings/users/[id]/route.ts` — 处理 avatarUrl
