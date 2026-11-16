# mltNews · 行业热点新闻聚合站

类 NewsNow 的分栏新闻看板：**8 个行业板块 × 每天 10 条**，部署在 GitHub Pages，
每天北京时间 08:00 由 GitHub Actions 自动抓取更新，零人工、零账号、零付费。

**线上地址**：https://a985987819.github.io/mltNews/

## 工作原理

```
GitHub Actions（cron: 0 0 * * * UTC = 北京时间 08:00）
  1. node scripts/fetch.mjs
       ├─ 读 config/sectors.yaml
       ├─ NewsNow 公开 API / 静态页正则解析 / 关键词兜底
       └─ 去重 → 置顶排序 → 截前 10 条 → 写 web/public/data/*.json
  2. git commit 数据文件并 push
  3. npm run build → GitHub Pages 重新部署

浏览器只读同源 JSON，不做任何跨域请求，国内可正常访问。
```

## 板块

| key | 名称 | 主源 |
|---|---|---|
| politics | 时政 | 澎湃新闻 / 参考消息 |
| finance | 金融 | 财联社 / 华尔街见闻 / 金十数据 |
| ai | AI | AI热点 / 36氪快讯 |
| optical | 光通信 | 光纤在线（静态页解析） |
| dev | 软件开发 | 掘金 / V2EX / GitHub Trending |
| security | 网络安全 | FreeBuf |
| machinery | 工程机械 | 柳工/三一关键词置顶 + 中国工程机械工业协会 |
| chemical | 化工 | 关键词兜底（综合财经源筛选） |

关键词兜底筛选池 = 兜底池（财联社 / 华尔街见闻 / 36氪快讯 / 澎湃新闻）**加上本轮已抓取的各板块
NewsNow 源响应**（复用已有请求结果，不增加请求数），主源不足时自动补足；
某板块当天抓取失败时复用此前数据并显示「数据可能延迟」。

## 目录结构

```
mltNews/
├─ .github/workflows/update.yml   # 定时抓取 + Pages 部署
├─ config/
│  └─ sectors.yaml                # ★ 用户唯一需要维护的文件
├─ scripts/
│  ├─ fetch.mjs                   # 抓取主入口
│  ├─ source-names.js             # 源 id → 中文名映射
│  └─ lib/                        # newsnow / html / util
├─ web/                           # Vite + React 18 + TypeScript
│  ├─ public/data/                # 抓取产物（进 git，Pages 数据来源）
│  └─ src/
└─ README.md
```

## 本地开发

```bash
# 抓取一次数据（产出 web/public/data/*.json）
npm install --prefix scripts
node scripts/fetch.mjs

# 前端
npm install --prefix web
npm run dev --prefix web      # http://localhost:5173
npm run build --prefix web    # 产物 web/dist
npm run preview --prefix web  # http://localhost:4173/mltNews/
```

排障时可单独调用模块，例如：

```bash
node -e "import('file://<本项目绝对路径>/scripts/lib/newsnow.mjs').then(m => m.fetchNewsNow('cls-hot', {limit: 3}).then(r => console.log(r)))"
```

## 日常维护

只需要改 **`config/sectors.yaml`**：

- 增删板块、更换 NewsNow 源 id、调整每板块条数
- 增删板块关键词（含 `machinery` 的 `priority_keywords` 置顶词）
- 添加 `html` 静态源时，必须按格式写好 `groups` 映射（字段按映射取，不硬编码下标）

改完无需改代码，下次定时运行自动生效。

## 部署说明（一次性初始化）

1. Settings → Pages → Source 选 **GitHub Actions**
2. Settings → Actions → General → Workflow permissions 选 **Read and write permissions**
3. Actions 页 → Update News → Run workflow 手动跑一次，确认线上可访问

## 免责声明

本站仅聚合各媒体公开发布的新闻标题与链接，所有内容版权归原作者及原媒体所有。点击标题将跳转至原始来源。本站不做内容存储与再分发，如有异议请联系删除。

抓取约束：单站每日 ≤2 次请求，串行间隔 ≥800ms，不并发，不遍历历史页。
