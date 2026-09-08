# 途账

旅行 AA 分账：记下谁付了钱、谁一起摊，实时算出总支出、每个人已付 / 应付，以及该收还是该给谁转。

## 给任何人用

- **账号**：Google、X，或邮箱注册。每个人用自己的账号。
- **群组**：登录后新建群组，把邀请码发给同行。对方登录后加入，就能一起记账。
- **与我相关**：看你垫了哪些大头、每个人该还你多少、你在别处还要摊多少。
- **示例**：不登录也能先玩本地演示账单。

## 本地运行

```bash
npm install
npm run dev
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
