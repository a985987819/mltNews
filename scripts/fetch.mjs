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

// ── NewsNow 源的运行内缓存：每个 id 每次运行只发一次请求 ──
// 同一源既是兜底池成员又是某板块主源（如 thepaper / 36kr-quick）时不重复请求；
// 失败结果也缓存（本运行内不再重试，规格 12.5：不做重试风暴）。
const newsnowCache = new Map(); // id → items[] | Error
let lastFetchAt = 0;

async function getNewsNow(id, opts, delayMs) {
  if (newsnowCache.has(id)) {
    const v = newsnowCache.get(id);
    if (v instanceof Error) throw v;
    return v;
  }
  const elapsed = Date.now() - lastFetchAt;
  if (lastFetchAt > 0 && elapsed < delayMs) await sleep(delayMs - elapsed);
  try {
    const items = await fetchNewsNow(id, opts);
    newsnowCache.set(id, items);
    return items;
  } catch (e) {
    newsnowCache.set(id, e instanceof Error ? e : new Error(String(e)));
    throw e;
  } finally {
    lastFetchAt = Date.now();
  }
}

async function main() {
  const cfg = parseYaml(readFileSync(path.join(ROOT, 'config', 'sectors.yaml'), 'utf8'));
  const { per_sector = 10, history_days = 30, request_delay_ms = 800, user_agent } = cfg.global;

  // 北京时间的“现在”；每次运行产出一份小时级快照（key 如 2026-11-17T08）
  const nowMs = Date.now();
  const bjNow = new Date(nowMs + 8 * 3600 * 1000);
  const today = bjNow.toISOString().slice(0, 10);
  const hour = bjNow.toISOString().slice(11, 13);
  const snapshotKey = `${today}T${hour}`;

  // ── 阶段 0：兜底池只抓一次并缓存，全板块共用（规格 5.2 的警告：不能放进板块循环）──
  const pool = []; // 兜底池 + 复用的板块源响应，关键词筛选的统一数据源
  for (const id of cfg.fallback_pool || []) {
    try {
      const got = await getNewsNow(id, { limit: 50, userAgent: user_agent }, request_delay_ms);
      pool.push(...got);
      log('ok', `兜底池 <- ${id}：${got.length} 条`);
    } catch (e) {
      log('warn', `兜底池 <- ${id} 失败：${e.message}`);
    }
  }
  const mergedPool = dedupe(pool);
  log('ok', `兜底池合计 ${mergedPool.length} 条（去重后）`);

  // 板块源响应复用：本轮已抓取的 NewsNow 板块源（财联社热榜/华尔街见闻/金十等）整份并入
  // 关键词筛选池，不增加请求数。规格 3.1 对工程机械的要求即“从财经源池里按企业名过滤”，
  // 仅靠 4 个兜底源时该池不完整，化工等纯兜底板块的命中率也会偏低。
  const reused = [];

  // ── 逐板块抓取 ──
  // 说明：不再“主源凑够即 break”地跳过其余源——所有配置过的源都会抓取一次（结果入池供
  // 关键词兜底使用），但板块已满时不再向板块内追加条目，板块构成与规格 3.4 的优先级一致。
  const result = {};
  for (const sector of cfg.sectors) {
    const items = [];
    for (const src of sector.sources || []) {
      const remaining = per_sector - items.length;
      try {
        let got = [];
        if (src.type === 'newsnow') {
          const all = await getNewsNow(src.id, { limit: 50, userAgent: user_agent }, request_delay_ms);
          reused.push(...all);
          if (remaining > 0) got = all.slice(0, Math.min(src.limit ?? per_sector, remaining));
        } else if (src.type === 'html') {
          if (remaining > 0) got = await fetchHtmlSource(src, { userAgent: user_agent });
        } else if (src.type === 'keyword') {
          // 显式 keyword 源：纯内存过滤，不发请求
          if (remaining > 0) {
            const filterPool = dedupe(pool.concat(reused));
            const seen = new Set(items.map((it) => normalizeTitle(it.title)));
            got = keywordFilter(filterPool, src.keywords, Math.min(src.limit ?? per_sector, remaining), seen);
          }
        } else {
          throw new Error(`未知 source type：${src.type}`);
        }
        items.push(...got);
        const suffix = remaining <= 0 && src.type === 'newsnow' ? '（板块已满，仅入池）' : '';
        log('ok', `${sector.key} <- ${describeSource(src)}：${got.length} 条${suffix}`);
      } catch (e) {
        log('warn', `${sector.key} <- ${describeSource(src)} 失败：${e.message}`); // 单源失败继续下一个
      }
    }

    // 自动兜底：主源不足时，用板块级 keywords 从池里补足（不拿无关内容凑数）
    if (items.length < per_sector) {
      const filterPool = dedupe(pool.concat(reused));
      const seen = new Set(items.map((it) => normalizeTitle(it.title)));
      const fill = keywordFilter(filterPool, sector.keywords, per_sector - items.length, seen);
      if (fill.length) {
        items.push(...fill);
        log('ok', `${sector.key} 关键词兜底补足 ${fill.length} 条（筛选池 ${filterPool.length} 条）`);
      }
    }

    // 去重 → 置顶排序 → 截断（规格 5.3 / 5.4）
    const finalItems = dedupe(items)
      .sort(makeComparator(sector.priority_keywords || []))
      .slice(0, per_sector);

    result[sector.key] = { name: sector.name, count: finalItems.length, degraded: false, items: finalItems };
    log('ok', `${sector.key}（${sector.name}）最终 ${finalItems.length} 条`);
  }

  // ── 降级：某板块 0 条 → 复用上一个快照的数据并标记 degraded（规格 5.5）──
  const listHistoryKeys = () => {
    let entries = [];
    try {
      entries = readdirSync(HISTORY_DIR);
    } catch {
      return []; // 首次运行时目录尚不存在
    }
    return entries
      .map((f) => /^(\d{4}-\d{2}-\d{2})T(\d{2})\.json$/.exec(f))
      .filter(Boolean)
      .map((m) => ({ key: `${m[1]}T${m[2]}`, date: m[1], time: m[2] }))
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  };

  for (const key of Object.keys(result)) {
    if (result[key].items.length > 0) continue;
    let reused = null;
    // 优先取时间上紧邻本快照之前的一份历史
    const prev = listHistoryKeys().find((s) => s.key < snapshotKey);
    if (prev) {
      const prevData = loadJson(path.join(HISTORY_DIR, `${prev.key}.json`));
      if (prevData?.sectors?.[key]?.items?.length) reused = prevData.sectors[key];
    }
    if (!reused) {
      const last = loadJson(path.join(DATA_DIR, 'latest.json'));
      if (last?.sectors?.[key]?.items?.length && last.snapshotKey !== snapshotKey) reused = last.sectors[key];
    }
    if (reused) {
      result[key] = { ...reused, degraded: true };
      log('warn', `${key} 本次 0 条，复用此前快照数据并标记 degraded`);
    } else {
      result[key].degraded = true;
      log('warn', `${key} 本次 0 条，且无历史快照可用`);
    }
  }

  // ── 输出（规格 5.6 / 6）：latest + 时间快照 + index ──
  mkdirSync(HISTORY_DIR, { recursive: true });
  const payload = {
    schemaVersion: 2,
    snapshotKey,
    date: today,
    generatedAt: new Date(nowMs).toISOString(),
    sectors: result,
  };
  writeJson(path.join(DATA_DIR, 'latest.json'), payload);
  writeJson(path.join(HISTORY_DIR, `${snapshotKey}.json`), payload);

  // index.json：列出全部时间快照（新→旧），前端下拉按此渲染
  const snapshots = listHistoryKeys();
  writeJson(path.join(DATA_DIR, 'index.json'), {
    schemaVersion: 2,
    latest: snapshotKey,
    snapshots,
    sectorOrder: cfg.sectors.map((s) => s.key),
    sectorNames: Object.fromEntries(cfg.sectors.map((s) => [s.key, s.name])),
  });

  // 快照文件只保留 history_days 天（git 提交历史里永久留档，删掉的随时可从 git 找回）
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - (history_days - 1) * 86400000)
    .toISOString()
    .slice(0, 10);
  let pruned = 0;
  for (const s of snapshots) {
    if (s.date >= cutoff) continue;
    try {
      unlinkSync(path.join(HISTORY_DIR, `${s.key}.json`));
      pruned++;
    } catch {
      /* 忽略单个文件删除失败 */
    }
  }
  if (pruned) log('ok', `已清理 ${pruned} 个过期快照文件（早于 ${cutoff}）`);

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
