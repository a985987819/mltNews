# mltNews · 行业热点新闻聚合站

类 NewsNow 的分栏新闻看板：**8 个行业板块 × 每板块 10 条**，部署在 GitHub Pages，
**每 3 小时**由 GitHub Actions 自动抓取一次并生成时间快照，零人工、零账号、零付费。

**线上地址**：https://a985987819.github.io/mltNews/

## 工作原理

```
GitHub Actions（cron: 0 */3 * * * UTC = 北京 08/11/14/17/20/23/02/05 点）
  1. node scripts/fetch.mjs
       ├─ 读 config/sectors.yaml
       ├─ NewsNow 公开 API / 静态页正则解析 / 关键词兜底
       └─ 去重 → 置顶排序 → 截前 10 条 → 写 web/public/data/*.json
  2. git commit 数据文件并 push（快照随 git 历史永久留档）
  3. npm run build → GitHub Pages 重新部署

浏览器只读同源 JSON，不做任何跨域请求，国内可正常访问。
```

## 数据快照

每次运行产出一份**小时级快照**：

- `latest.json` —— 最新一份，首屏默认加载
- `history/{日期}T{小时}.json`（如 `2026-11-17T08.json`）—— 保留最近 7 天
- `index.json` —— 列出全部可用快照，前端「快照」下拉按此渲染（最新一份标「· 最新」）
- git 提交历史里**永久**保留所有快照，被清理的文件随时可从历史找回
- 某板块本次抓取失败 → 自动复用上一个快照的数据并标记「数据可能延迟」

## 为什么不需要后端

本项目的更新是纯定时批处理（每次运行约 60 秒、十几个请求、写几个 JSON），没有长连接、
用户态、事务这类常驻服务的价值点；GitHub Actions 恰好就是免费的无服务器定时执行器，
git 恰好就是带完整历史的快照存储，Pages 恰好解决同源读取与国内可达性。三者组合已经
覆盖全部需求，自建后端只会新增托管成本与故障面。将来若出现正文抓取、全文检索、实时
推送等需求，`scripts/` 下的模块化抓取逻辑可直接迁移进后端 worker。

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

关键词兜底筛选池 = 兜底池（财联社 / 华尔街见闻 / 36氪快讯 / 澎湃新闻）**加上本轮已抓取的
各板块 NewsNow 源完整响应**（源级缓存去重请求，不增加请求数），主源不足时自动补足；
某板块本次抓取失败时复用上一个快照的数据并显示「数据可能延迟」。

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

抓取约束：NewsNow 单源每 3 小时 1 次（每次运行 13 次请求）；静态列表页单站每日 8 次（3 小时
1 次、串行间隔 ≥800ms、只抓单页、不遍历历史页）。
