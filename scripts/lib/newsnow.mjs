// NewsNow 公开 API 客户端（规格 3.2 / 5.2）
// GET https://newsnow.busiyi.world/api/s?id={sourceId}
// status 为 success 或 cache 均可用；url 缺失的条目跳过
import { SOURCE_NAMES } from '../source-names.js';

const ENDPOINT = 'https://newsnow.busiyi.world/api/s?id=';

export async function fetchNewsNow(id, { limit = 10, userAgent, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`超时 ${timeoutMs}ms`)), timeoutMs);
  try {
    const res = await fetch(ENDPOINT + encodeURIComponent(id), {
      headers: { 'User-Agent': userAgent || 'Mozilla/5.0', Accept: 'application/json' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.status !== 'success' && data?.status !== 'cache') {
      throw new Error(`status=${data?.status ?? 'unknown'}`);
    }

    // publishedAt：条目级 extra.date 优先，其次响应级 extra.date / updatedTime（毫秒）
    const fallbackDate = data?.extra?.date ?? (data?.updatedTime ? data.updatedTime : null);
    const items = [];
    for (const raw of data.items || []) {
      if (!raw?.title || !raw?.url) continue; // url 缺失则跳过（规格 3.2）
      const publishedAt = raw?.extra?.date ?? fallbackDate;
      const iso = publishedAt ? new Date(publishedAt).toISOString() : null;
      items.push({
        title: String(raw.title).trim(),
        url: String(raw.url),
        source: SOURCE_NAMES[id] || id,
        publishedAt: iso && !Number.isNaN(Date.parse(iso)) ? iso : null,
      });
      if (items.length >= limit) break;
    }
    return items;
  } finally {
    clearTimeout(timer);
  }
}
