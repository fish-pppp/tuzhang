# mr-daily-monitor

每天拉取 **GitLab 已合入 MR**，用规则打风险，再用公司内网 **通义千问** 提炼功能点和建议测试用例，产出当日测试简报。

不调用公网 OpenAI / Claude。千问只走你配置的内网网关；模型不可用时自动降级为标题/描述简报。

## 需要什么

- Node.js 20+
- 能读目标项目已合入 MR 的 GitLab token（`read_api` 即可）
- 公司内网通义千问，推荐 **OpenAI 兼容** 地址（`.../compatible-mode/v1` 或 `.../v1`）

## 快速开始

```bash
cd mr-daily-monitor
cp config.example.yml config.yml
cp .env.example .env
# 编辑 config.yml 的 gitlab.url / projects
# 编辑 .env 的 GITLAB_TOKEN 与 QWEN_*
npm install
npm run digest -- run --since yesterday --config config.yml --dry-run
```

报告写到 `reports/YYYY-MM-DD.md` 和 `.json`。`--dry-run` 或 `DRY_RUN=1` 只写文件、不发 webhook。样例见 [examples/sample-brief.md](examples/sample-brief.md)。

```bash
npm run digest -- run --since today
npm run digest -- run --since 2026-09-07
npm run digest -- run --from 2026-09-07T00:00:00+08:00 --to 2026-09-08T00:00:00+08:00
```

## 环境变量

| 变量 | 含义 |
| --- | --- |
| `GITLAB_TOKEN` | GitLab 私有 token |
| `QWEN_BASE_URL` | 内网千问网关，不要写死公网百炼 |
| `QWEN_API_KEY` | 内网 token |
| `QWEN_MODEL` | 如 `qwen-plus` / `qwen-turbo` / 公司别名 |
| `FEISHU_WEBHOOK_URL` | 可选，飞书或通用 webhook |
| `DRY_RUN` | `1` 时不发通知 |

`config.yml` 里 `qwen.protocol`:

- `compatible`（默认）：`openai` SDK → `POST {baseURL}/chat/completions`
- `dashscope`：原生 `POST {baseURL}/api/v1/services/aigc/text-generation/generation`

## 风险规则

确定性、不依赖模型：

- 大 diff、单文件变更过浓
- 依赖文件、敏感路径（auth / payment / migration 等）
- 源码变更但无测试、删除测试
- 新增 TODO/FIXME/HACK、调试残留

## 定时跑

把本目录当成独立仓库时，用自带的 [`.gitlab-ci.yml`](.gitlab-ci.yml) 建 Pipeline schedule。变量配在 CI/CD Variables 里。

## 测试

```bash
npm test
```
