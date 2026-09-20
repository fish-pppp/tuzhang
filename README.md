# 途账

旅行 AA 分账：记下谁付了钱、谁一起摊，实时算出总支出、每个人已付 / 应付，以及该收还是该给谁转。

## 给任何人用

- **账号**：Google、X，或邮箱注册。每个人用自己的账号。
- **群组**：登录后新建群组，把邀请码发给同行。对方登录后加入，就能一起记账。
- **与我相关**：看你垫了哪些大头、每个人该还你多少、你在别处还要摊多少。
- **自定义分摊**：记账时可以平均 AA，也可以按人填不同价格。
- **提前结算**：线下转完账后锁定本期账单，已结算的记录不能再改；之后新账重新算。
- **导出记录**：把账本存成一份 Markdown，方便存档或对账。
- **示例**：不登录也能先玩本地演示账单。

当前版本 **1.1.0**（2026年9月20日更新），页面底部和导出文件里都会写上版本号与更新日期。

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

**中国大陆打不开 `*.vercel.app` 是预期现象**，改 Vercel 地区或绑自定义域名但仍然 CNAME 到 Vercel，都解决不了。国内访问请看下面的「国内访问」。

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
- **国内打不开**：Vercel 在中国大陆没有节点。见下一节。

## 国内访问

Vercel 的 CDN 和 `*.vercel.app` 在中国大陆经常被墙或完全超时。这不是网站代码坏了，也不是你没开「亚洲区域」——**平台本身到不了大陆**。

### 推荐：香港 / 新加坡 / 日本 VPS 自建

不需要 ICP 备案。买一台香港、新加坡或日本的轻量（阿里云国际、腾讯云国际、搬瓦工、Vultr 都可以），域名 **A 记录指到这台机器**，不要 CNAME 到 `cname.vercel-dns.com`。

服务器上需要 Docker。在仓库根目录：

```bash
cp .env.example .env
openssl rand -base64 32          # 写入 BETTER_AUTH_SECRET
# 编辑 .env：
#   BETTER_AUTH_URL=https://你的域名     # 不要末尾斜杠，必须和浏览器地址栏一致
#   POSTGRES_PASSWORD=换成强密码         # 可选；不填则用 tuzhang
```

```bash
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

不要把本地开发用的 `BETTER_AUTH_URL=http://localhost:8080` 直接拿去生产。VPS 上单独写一份 `.env`，只填线上域名和密钥。

容器会：

1. 起本机 Postgres（不必再连 Neon；大陆访问 Neon 也不稳）
2. 启动时跑 `db:migrate`
3. 在 `:3000` 提供站点，并提供 `/api/health`

前面再挂 HTTPS。仓库里有一份 Caddy 示例 `deploy/Caddyfile`：把域名解析到 VPS 后，用 Caddy 反代 `127.0.0.1:3000`。登录 Cookie 带 `Secure` 和 `__Host-`，**公网必须是 https**，不要用 `http://IP:3000` 给同行用。

同时开了 `www` 和裸域时，把另一个 origin 写进 `BETTER_AUTH_TRUSTED_ORIGINS`。

国内用户请用 **邮箱注册**。Google / X 在大陆通常打不开；生产镜像默认不显示这两个按钮（`VITE_SHOW_OAUTH=false`）。

### 备选：域名已备案，用国内 CDN

如果域名已经 ICP 备案，可以用阿里云 CDN、腾讯云 CDN 或 EdgeOne 回源到：

- 上面这台香港 / 新加坡机器，或
- 仍放在 Vercel 上的源站

未备案不能用国内 CDN 做大陆加速。只把自定义域名 CNAME 到 Vercel，流量还是走被墙的 IP。

### 不要指望这些办法

| 做法 | 为什么不够 |
| --- | --- |
| 继续用 `xxx.vercel.app` | 域名和 IP 都常被墙 |
| 自定义域名但仍解析到 Vercel | 还是 Vercel 的 Anycast IP |
| Cloudflare 免费橙云回源 Vercel | Cloudflare 在大陆也不稳 |
| 只换 Neon 区域 | 浏览器根本连不上 Vercel，到不了数据库这一步 |

### 自建常见问题

- **登录报 Invalid origin**：`BETTER_AUTH_URL` 必须等于地址栏 origin（`https://`，无末尾 `/`）。
- **登录后立刻掉线**：用了 http 或 IP。给站点套上 https 域名。
- **构建 / 启动要 `BETTER_AUTH_SECRET`**：生产镜像会检查。和 Vercel 一样，用 `openssl rand -base64 32` 生成，写进 `.env`。
