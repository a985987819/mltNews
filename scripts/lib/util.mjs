// 通用工具：标题清洗、去重、排序、关键词过滤、时间解析（规格 5.2 / 5.3 / 5.4）

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BASIC_ENTITIES = {
  '&nbsp;': ' ', '&nbsp': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&apos;': "'", '&#39;': "'", '&bull;': '·', '&middot;': '·', '&ldquo;': '“', '&rdquo;': '”',
  '&lsquo;': '‘', '&rsquo;': '’', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…', '&times;': '×',
};

// 去 HTML 标签、常见实体、压缩空白（规格 5.2 第 4 点）
export function cleanTitle(raw) {
  if (raw == null) return '';
  let t = String(raw).replace(/<[^>]*>/g, ' ');
  t = t.replace(/&#(\d+);/g, (_, n) => {
    const code = Number(n);
    return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : ' ';
  });
  for (const [k, v] of Object.entries(BASIC_ENTITIES)) t = t.split(k).join(v);
  return t.replace(/[\s\u3000]+/g, ' ').trim();
}

// 判重键的标题归一化（规格 5.3）
export function normalizeTitle(t) {
  return String(t ?? '')
    .replace(/[\s\u3000]/g, '')
    .replace(/[，。！？、；：“”‘’（）()《》【】〔〕\-—…·,.!?;:'"()\[\]{}]/g, '')
    .toLowerCase();
}

function safePathname(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url || '';
  }
}

// 同一板块内去重：标题归一化优先，其次 url pathname；保留先出现者（主源优先级更高）
export function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = normalizeTitle(it.title) || safePathname(it.url);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(it);
  }
  return out;
}

// 'YYYYMMDDhhmmss' → 按北京时间解析，转 UTC ISO 存储（规格 5.2 第 5 点）
export function parseBeijingTime(digits, _format) {
  if (!digits || !/^\d{14}$/.test(digits)) return null;
  const y = Number(digits.slice(0, 4));
  const mo = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  const h = Number(digits.slice(8, 10));
  const mi = Number(digits.slice(10, 12));
  const s = Number(digits.slice(12, 14));
  return new Date(Date.UTC(y, mo - 1, d, h - 8, mi, s)).toISOString();
}

// null 时间不参与 Date 比较（会变成 1970，规格 5.4 的坑），显式判空：null 排后、保持原顺序
export function compareTime(a, b) {
  const ta = a.publishedAt ? Date.parse(a.publishedAt) : null;
  const tb = b.publishedAt ? Date.parse(b.publishedAt) : null;
  if (ta === null && tb === null) return 0;
  if (ta === null) return 1;
  if (tb === null) return -1;
  return tb - ta;
}

// 第一步置顶：命中 priority_keywords 的排最前；第二步组内按时间倒序（规格 5.4）
export function makeComparator(priorityKeywords) {
  const pk = Array.isArray(priorityKeywords) ? priorityKeywords : [];
  const hit = (x) => {
    if (!pk.length) return 0;
    const t = String(x.title).toLowerCase();
    return pk.some((k) => t.includes(String(k).toLowerCase())) ? 1 : 0;
  };
  return (a, b) => hit(b) - hit(a) || compareTime(a, b);
}

// 单个关键词匹配：含非 ASCII（中文）的词大小写不敏感；纯 ASCII 词区分大小写，
// 避免 PTA 误命中 TapTap、API 误命中 rapid、RAG 误命中 storage 这类短词假阳性
function matchKeyword(title, keyword) {
  if (/^[\x00-\x7F]+$/.test(keyword)) return title.includes(keyword);
  return title.toLowerCase().includes(keyword.toLowerCase());
}

// 从池里按关键词筛（纯内存，不发请求）。excludeTitles 为已入选条目的归一化标题集合
export function keywordFilter(items, keywords, limit, excludeTitles) {
  if (!Array.isArray(keywords) || keywords.length === 0 || !(limit > 0)) return [];
  const exclude = excludeTitles || new Set();
  const out = [];
  for (const it of items || []) {
    if (out.length >= limit) break;
    const t = String(it.title);
    if (!keywords.some((k) => matchKeyword(t, String(k)))) continue;
    const key = normalizeTitle(it.title);
    if (key && exclude.has(key)) continue;
    exclude.add(key);
    out.push(it);
  }
  return out;
}
