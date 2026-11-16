// 行业热点新闻聚合站 · 抓取主入口（规格 5.1）
// 用法：node scripts/fetch.mjs   （GitHub Actions 每天跑一次；本地也可手动跑）
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

import { fetchNewsNow } from './lib/newsnow.mjs';
import { fetchHtmlSource } from './lib/html.mjs';
import { dedupe, makeComparator, keywordFilter, normalizeTitle, sleep } from './lib/util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'web', 'public', 'data');
const HISTORY_DIR = path.join(DATA_DIR, 'history');

function log(level, msg) {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
  (level === 'warn' ? console.warn : console.log)(line);
}

function describeSource(src) {
  if (src.type === 'newsnow') return `newsnow:${src.id}`;
  if (src.type === 'html') return `html:${src.url}`;
  if (src.type === 'keyword') return `keyword:[${(src.keywords || []).join(',')}]`;
  return String(src.type);
}

function loadJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, obj) {
  writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

async function main() {
  const cfg = parseYaml(readFileSync(path.join(ROOT, 'config', 'sectors.yaml'), 'utf8'));
  const { per_sector = 10, history_days = 30, request_delay_ms = 800, user_agent } = cfg.global;

  // 北京时间的“今天”（Actions 在 UTC 00:0x 运行，对应北京当天早上）
  const nowMs = Date.now();
  const today = new Date(nowMs + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  // ── 阶段 0：兜底池只抓一次并缓存，全板块共用（规格 5.2 的警告：不能放进板块循环）──
  const pool = [];
  for (const id of cfg.fallback_pool || []) {
    try {
      const got = await fetchNewsNow(id, { limit: 50, userAgent: user_agent });
      pool.push(...got);
      log('ok', `兜底池 <- ${id}：${got.length} 条`);
    } catch (e) {
      log('warn', `兜底池 <- ${id} 失败：${e.message}`);
    }
    await sleep(request_delay_ms);
  }
  const mergedPool = dedupe(pool);
  log('ok', `兜底池合计 ${mergedPool.length} 条（去重后）`);

  // ── 逐板块抓取 ──
  const result = {};
  for (const sector of cfg.sectors) {
    const items = [];
    for (const src of sector.sources || []) {
      if (items.length >= per_sector) break; // 主源凑够即停（规格 3.4 优先级原则）
      const isNetwork = src.type !== 'keyword';
      try {
        let got = [];
        if (src.type === 'newsnow') {
          got = await fetchNewsNow(src.id, { limit: src.limit ?? per_sector, userAgent: user_agent });
        } else if (src.type === 'html') {
          got = await fetchHtmlSource(src, { userAgent: user_agent });
        } else if (src.type === 'keyword') {
          // 显式 keyword 源：纯内存过滤，不发请求
          const seen = new Set(items.map((it) => normalizeTitle(it.title)));
          got = keywordFilter(mergedPool, src.keywords, Math.min(src.limit ?? per_sector, per_sector - items.length), seen);
        } else {
          throw new Error(`未知 source type：${src.type}`);
        }
        items.push(...got);
        log('ok', `${sector.key} <- ${describeSource(src)}：${got.length} 条`);
      } catch (e) {
        log('warn', `${sector.key} <- ${describeSource(src)} 失败：${e.message}`); // 单源失败继续下一个
      }
      if (isNetwork) await sleep(request_delay_ms);
    }

    // 自动兜底：主源不足时，用板块级 keywords 从池里补足（不拿无关内容凑数）
    if (items.length < per_sector) {
      const seen = new Set(items.map((it) => normalizeTitle(it.title)));
      const fill = keywordFilter(mergedPool, sector.keywords, per_sector - items.length, seen);
      if (fill.length) {
        items.push(...fill);
        log('ok', `${sector.key} 关键词兜底补足 ${fill.length} 条`);
      }
    }

    // 去重 → 置顶排序 → 截断（规格 5.3 / 5.4）
    const finalItems = dedupe(items)
      .sort(makeComparator(sector.priority_keywords || []))
      .slice(0, per_sector);

    result[sector.key] = { name: sector.name, count: finalItems.length, degraded: false, items: finalItems };
    log('ok', `${sector.key}（${sector.name}）最终 ${finalItems.length} 条`);
  }

  // ── 降级：某板块 0 条 → 复用昨日数据并标记 degraded（规格 5.5）──
  for (const key of Object.keys(result)) {
    if (result[key].items.length > 0) continue;
    const yDay = loadJson(path.join(HISTORY_DIR, `${yesterday}.json`));
    let reused = yDay?.sectors?.[key]?.items?.length ? yDay.sectors[key] : null;
    if (!reused) {
      const last = loadJson(path.join(DATA_DIR, 'latest.json'));
      if (last && last.date !== today && last.sectors?.[key]?.items?.length) reused = last.sectors[key];
    }
    if (reused) {
      result[key] = { ...reused, degraded: true };
      log('warn', `${key} 今日 0 条，复用此前数据并标记 degraded`);
    } else {
      result[key].degraded = true;
      log('warn', `${key} 今日 0 条，且无历史数据可用`);
    }
  }

  // ── 输出（规格 5.6 / 6）──
  mkdirSync(HISTORY_DIR, { recursive: true });
  const payload = { schemaVersion: 1, date: today, generatedAt: new Date(nowMs).toISOString(), sectors: result };
  writeJson(path.join(DATA_DIR, 'latest.json'), payload);
  writeJson(path.join(HISTORY_DIR, `${today}.json`), payload);

  // index.json：重算日期索引
  const dates = new Set([today]);
  for (const f of readdirSync(HISTORY_DIR)) {
    const m = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f);
    if (m) dates.add(m[1]);
  }
  const dateList = [...dates].sort((a, b) => (a < b ? 1 : -1));
  writeJson(path.join(DATA_DIR, 'index.json'), {
    schemaVersion: 1,
    latest: today,
    dates: dateList,
    sectorOrder: cfg.sectors.map((s) => s.key),
    sectorNames: Object.fromEntries(cfg.sectors.map((s) => [s.key, s.name])),
  });

  // 历史只保留 history_days 天
  let pruned = 0;
  for (const d of dateList.slice(history_days)) {
    try {
      unlinkSync(path.join(HISTORY_DIR, `${d}.json`));
      pruned++;
    } catch {
      /* 忽略单个文件删除失败 */
    }
  }
  if (pruned) log('ok', `已清理 ${pruned} 个过期历史文件`);

  // 全站全空 → 非零退出，让 Actions 报红并发通知邮件（规格 5.5）
  const total = Object.values(result).reduce((n, s) => n + s.items.length, 0);
  if (total === 0) {
    log('warn', '所有板块均为空，按失败退出');
    process.exitCode = 1;
  } else {
    log('ok', `完成：${today}，共 ${total} 条 → web/public/data/`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
