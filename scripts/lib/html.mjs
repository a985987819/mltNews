// HTML 静态列表页源解析（规格 3.3 / 5.2）
// ⚠️ 两个站的 article_regex 分组数不同（c-fol 3 组、cncma 2 组），必须按配置里的
//    groups 映射取字段，禁止硬编码下标 —— 这是规格文档实测踩到的坑（坑 #12）。
import { cleanTitle, parseBeijingTime } from './util.mjs';
import { SOURCE_NAMES } from '../source-names.js';

const TIMEOUT_MS = 20000;

function detectCharset(buffer, contentType) {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType || '')?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const head = buffer.subarray(0, 4096).toString('latin1');
  const meta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  return (meta || 'utf-8').toLowerCase();
}

// c-fol.net → 'c-fol'，cncma.org → 'cncma'（对应 source-names.js 里的中文显示名）
function sourceIdFromUrl(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '').split('.')[0];
  } catch {
    return 'html';
  }
}

export async function fetchHtmlSource(src, { userAgent } = {}) {
  const groups = src.groups;
  if (!groups?.link || !groups?.title) {
    throw new Error(`配置缺少 groups(link/title) 映射，拒绝按固定下标解析：${src.url}`);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`超时 ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
  let buffer;
  let contentType = '';
  try {
    const res = await fetch(src.url, {
      headers: { 'User-Agent': userAgent || 'Mozilla/5.0', Accept: 'text/html,*/*' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    contentType = res.headers.get('content-type') || '';
    buffer = Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }

  // 编码：先看 charset（规格 5.2 第 1 点；c-fol / cncma 实测均为 UTF-8）
  const charset = detectCharset(buffer, contentType);
  const htmlText = /gb2312|gbk|gb18030/.test(charset)
    ? new TextDecoder('gbk').decode(buffer)
    : new TextDecoder('utf-8').decode(buffer);

  const re = new RegExp(src.article_regex, 'g');
  const sourceName = SOURCE_NAMES[sourceIdFromUrl(src.url)] || sourceIdFromUrl(src.url);
  const limit = src.limit ?? 10;
  const items = [];
  for (const m of htmlText.matchAll(re)) {
    const title = cleanTitle(m[groups.title] ?? '');
    if (title.length < 8) continue; // 标题过短视为误命中（规格 3.3.1）

    let link = m[groups.link] || '';
    if (link.startsWith('//')) link = 'http:' + link; // 协议相对（坑 #8）
    else if (!/^https?:/i.test(link)) link = (src.link_prefix || '') + link;

    let publishedAt = null;
    if (groups.time && m[groups.time]) {
      publishedAt = parseBeijingTime(m[groups.time], src.time_format || 'YYYYMMDDhhmmss');
    }

    items.push({ title, url: link, source: sourceName, publishedAt });
    if (items.length >= limit) break;
  }

  if (items.length === 0) throw new Error('解析出 0 条（视同失败，规格 5.5）');
  return items;
}
