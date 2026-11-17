import type { DataIndex, NewsData } from '../types';

// 数据文件用相对 base 拼接，不写绝对路径（规格 8.3）
const BASE = import.meta.env.BASE_URL;
const cache = new Map<string, Promise<NewsData>>();

// bust=true 时绕过 HTTP 缓存（新快照轮询）
export async function loadIndex(bust = false): Promise<DataIndex> {
  const res = await fetch(`${BASE}data/index.json`, { cache: bust ? 'reload' : 'default' });
  if (!res.ok) throw new Error(`index.json HTTP ${res.status}`);
  return (await res.json()) as DataIndex;
}

// isLatest=true 读 latest.json，否则读 history/{key}.json（key 如 2026-11-17T08）；
// bust=true 绕过内存与 HTTP 缓存（刷新按钮）
export function loadNewsData(key: string, isLatest: boolean, bust = false): Promise<NewsData> {
  const url = `${BASE}data/${isLatest ? 'latest' : `history/${key}`}.json`;
  if (bust) cache.delete(url);
  let p = cache.get(url);
  if (!p) {
    p = fetch(url, { cache: bust ? 'reload' : 'default' }).then(async (res) => {
      if (!res.ok) throw new Error(`${isLatest ? 'latest' : key} HTTP ${res.status}`);
      return (await res.json()) as NewsData;
    });
    cache.set(url, p);
  }
  return p;
}
