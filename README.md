# 途账

旅行 AA 分账：记下谁付了钱、谁一起摊，实时算出总支出、每个人已付 / 应付，以及该收还是该给谁转。

## 给任何人用

- **账号**：Google、X，或邮箱注册。每个人用自己的账号。
- **群组**：登录后新建群组，把邀请码发给同行。对方登录后加入，就能一起记账。
- **与我相关**：看你垫了哪些大头、每个人该还你多少、你在别处还要摊多少。
- **示例**：不登录也能先玩本地演示账单。

## 本地运行

需要 Node.js ≥ 20。数据库两种选法：

- **推荐：本机 Postgres**（账号、群组、账单都会持久保存）。
- **零配置：不填 `DATABASE_URL`**，自动用内存版 PGLite —— 能跑起来，但每次重启 dev server 数据清空。

```bash
# 1. 依赖
npm install

# 2. 数据库（推荐 Docker；也可以用本机已装好的 Postgres）
docker compose up -d          # 起一个 postgres:16，用户名/密码/库名都是 tuzhang
# 没有 Docker 时（Ubuntu/Debian）：
#   sudo apt install postgresql && sudo service postgresql start
#   sudo -u postgres psql -c "create user tuzhang with password 'tuzhang' superuser;" \
#                          -c "create database tuzhang owner tuzhang;"

# 3. 环境变量
cp .env.example .env          # 默认值已对准上面的 docker compose，可直接用

# 4. 建表（幂等，可反复执行）
npm run db:migrate

# 5. 启动
npm run dev                   # http://localhost:8080
```

打开 <http://localhost:8080> → 右上角 **登录** → 切到 **注册**（邮箱 + 至少 8 位密码）→ 回到首页 **新建** 群组 → 复制邀请码发给同行。

### 本地常见问题

| 现象 | 原因 / 解法 |
| --- | --- |
| 登录后刷新又变成未登录 | 请用 `http://localhost:8080` 访问。会话 Cookie 带 `Secure` 标志，浏览器只对 `localhost` 放行 http；用局域网 IP（如 `http://192.168.x.x:8080`）打开时 Cookie 会被丢弃。手机联调请用 https 反向代理或 `localhost` 端口转发。 |
| 登录报「Invalid origin」 | 地址栏 origin 必须和 `.env` 里 `BETTER_AUTH_URL` 一致（含协议、端口，无末尾 `/`）。 |
| `npm run db:migrate` 连不上 | 确认 `docker compose ps` 里 db 是 healthy；`DATABASE_URL` 的端口 / 密码和 compose 文件一致。 |
| 重启后账号全没了 | 没配 `DATABASE_URL`，跑在内存 PGLite 上。按上面第 2、3 步接上 Postgres。 |
| Google / X 按钮点了报错 | 没有 `GROK_AUTH_*` 密钥时属预期行为，用邮箱注册即可。 |

### 检查命令

```bash
npm run typecheck   # tsc
npm run lint        # eslint
npm test            # node --test scripts/**/*.test.mjs
npm run build       # vite build + db:migrate（无 DATABASE_URL 时跳过迁移）
```

## 部署到 Vercel

本仓库用 TanStack Start + Nitro 的 `vercel` preset，可直接接到 Vercel。线上必须接真实 Postgres（不要用本地 PGLite），否则群组和登录状态无法跨请求保存。

### 1. 准备 Postgres（推荐 Neon）

1. 打开 [Neon](https://neon.tech) 或 Vercel Marketplace 的 **Neon** 集成，新建一个项目。
2. 复制 **pooled** 连接串（主机名里通常带 `-pooler`），作为 `DATABASE_URL`。
3. 需要能从公网连上，并带 SSL（Neon 默认即可）。

### 2. 准备环境变量

在仓库根目录复制一份本地参考：

```bash
cp .env.example .env
openssl rand -base64 32   # 得到 BETTER_AUTH_SECRET
```

| 变量 | 是否必需 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 线上必需 | Neon / 任意 Postgres 连接串。构建时会跑 `npm run db:migrate`。 |
| `BETTER_AUTH_SECRET` | 线上必需 | 登录会话签名密钥。每个 Serverless 实例不能各自随机，否则会掉登录。 |
| `BETTER_AUTH_URL` | 自定义域名时建议 | 站点公网 origin，不要末尾斜杠，例如 `https://tuzhang.vercel.app`。不填则自动用 Vercel 部署域名。 |
| `VITE_AUTH_ENABLED` | 可选 | 默认开启登录。只有本地调试才设成 `false`。 |
| `GROK_AUTH_ISSUER` / `GROK_AUTH_CLIENT_ID` / `GROK_AUTH_CLIENT_SECRET` | 可选 | Grok 登录中转（Google / X）。自己部署时一般没有这些密钥，**请用邮箱注册**。 |

### 3. 在 Vercel 导入仓库

1. 打开 [vercel.com/new](https://vercel.com/new)，用 GitHub 登录并 Import **`fish-pppp/tuzhang`**。
2. Framework Preset 选 **TanStack Start**（仓库里的 `vercel.json` 已写明）。不要改 Output Directory。
3. Build Command 保持 `npm run build`（会先打包再执行迁移）。
4. 在 **Environment Variables** 里填上表中的变量，勾选 Production / Preview / Development。
5. Deploy。第一次成功后，把 Production URL 填回 `BETTER_AUTH_URL`（或绑自定义域名后再填），然后 Redeploy 一次。

没有 Vercel 账号密钥时，无法从这边替你点 Deploy。你在 Dashboard 点一次即可；之后 push `main` 会自动发版。

### 4. 上线后怎么用

- 打开站点 → **登录** → **注册**（邮箱 + 至少 8 位密码）。
- 建群、发邀请码 `/join/<code>`，同行用自己的账号加入。
- Google / X 按钮在没有 `GROK_AUTH_*` 时会失败，这是预期行为。

### 常见问题

- **构建报 `DATABASE_URL is required on Vercel`**：变量没配，或只配了 Production、Preview 构建读不到。三个环境都勾上。
- **构建报 `BETTER_AUTH_SECRET is required`**：同上，补上密钥后 Redeploy。
- **登录提示 Invalid origin**：`BETTER_AUTH_URL` 必须和浏览器地址栏 origin 一致（含 `https://`，无末尾 `/`）。自定义域名也要写进去。
- **数据隔天没了**：没配 `DATABASE_URL` 时本地预览走内存库；Vercel 上已禁止这种部署。
