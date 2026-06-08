# 本地开发直连生产 RDS + OSS 设计方案

**日期**: 2026-06-08  
**状态**: 待实施

## 1. 目标

本地开发环境直接连通生产环境的 RDS 和 OSS，实现开发与生产环境一致。当 ECS 生产端出现需求或 bug 时，可直接在本地修复和迭代。

## 2. 方案决策

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 数据共享策略 | **完全共享**（同一 RDS + 同一 OSS bucket） | 环境一致，修改立即可见 |
| 数据库连接方式 | **SSH 隧道转发** | 无需暴露 RDS 公网，安全性高，无需配置 IP 白名单 |
| OSS 配置 | 以本地 `.env.local` 为准（`oss-cn-hangzhou` / `huadong-erp`） | 本地配置即为生产实际配置 |
| 本地 Docker PostgreSQL | **停用** | 已连生产 RDS，无需本地容器 |

## 3. 架构

```
本地开发机器                             阿里云
┌─────────────────┐         ┌──────────────────────────────┐
│  Next.js Dev     │         │        ECS                   │
│  :3000           │  SSH隧道  │  ┌──────────────────────┐   │
│                 │◄────────►│  │  Docker 容器          │   │
│  .env.local     │ :5432→RDS│  │  Next.js Production   │   │
│  DATABASE_URL   │          │  └──────────────────────┘   │
│  =localhost:5432│          │            │                │
│                 │          │       VPC 内网               │
└────────┬────────┘          └────────────┼────────────────┘
         │                                │
         │  HTTPS 公网                    │ 内网
         ▼                                ▼
┌─────────────────┐         ┌──────────────────────────────┐
│  阿里云 OSS     │         │  阿里云 RDS PostgreSQL      │
│  oss-cn-hangzhou│         │  rm-xxx.pg.rds.aliyuncs.com  │
│  bucket:        │         │  :5432                       │
│  huadong-erp    │         └──────────────────────────────┘
└─────────────────┘
```

## 4. 具体改动

### 4.1 新建 `scripts/rds-tunnel.sh`

SSH 隧道管理脚本，支持 start/stop/status 三个子命令。

- 优先使用 `autossh`（断线自动重连），未安装时退化为普通 `ssh`
- 配置 SSH keepalive（`ServerAliveInterval=30`, `ServerAliveCountMax=3`）
- 本地端口映射：`localhost:5432` → ECS 内网 → RDS `:5432`

**需用户提供的参数**：
- ECS 公网 IP
- ECS SSH 用户名（默认 root）
- RDS 内网地址（如 `rm-xxxxx.pg.rds.aliyuncs.com`）

### 4.2 修改 `.env.local` — 数据库连接

```diff
- DATABASE_URL="postgresql://erp_admin:erp_local_dev_2026@localhost:5433/huadong_erp?schema=public"
+ DATABASE_URL="postgresql://erp_admin:<生产RDS密码>@localhost:5432/huadong_erp?schema=public&sslmode=require"
```

变化：
- 端口 `5433` → `5432`（隧道映射端口）
- 密码使用生产 RDS 实际密码
- 添加 `sslmode=require`（RDS 强制 SSL）

### 4.3 OSS 配置 — 保持不变

`.env.local` 中 OSS 配置已与生产一致，无需修改。同步更新 `.env.production` 与本地对齐。

### 4.4 停用 Docker PostgreSQL

```bash
docker-compose down
```

`docker-compose.yml` 文件保留不删，方便离线开发时恢复。

### 4.5 新建 `scripts/dev-setup.sh`

一键启动开发环境脚本：

```bash
bash scripts/rds-tunnel.sh start
npm run dev
```

## 5. 工作流程

```bash
# 开始开发
bash scripts/rds-tunnel.sh start   # 建立隧道
npm run dev                         # 启动开发服务器

# 结束开发
Ctrl+C                              # 停止 dev server
bash scripts/rds-tunnel.sh stop     # 关闭隧道
```

## 6. 涉及文件

| 文件 | 操作 |
|------|------|
| `scripts/rds-tunnel.sh` | **新建** |
| `scripts/dev-setup.sh` | **新建** |
| `.env.local` | **修改** DATABASE_URL |
| `.env.production` | **修改** OSS 配置对齐 |
| `docker-compose.yml` | 不修改（容器手动停） |

## 7. 约束与注意事项

- `.env.local` 已在 `.gitignore`，包含生产密码不会外泄
- 数据库密码存储在 `.env.local` 中，安全级别与生产一致
- 本地**不执行** Prisma migrate / db push，以免无意中修改生产数据库 schema
- 推荐安装 `autossh`：`brew install autossh`
- ECS 需允许本地 SSH 连接（应已开通）
- 确保本地 5432 端口未被占用
