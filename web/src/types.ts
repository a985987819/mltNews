// 与 scripts/fetch.mjs 输出的 JSON 结构对应（规格 6）
export interface NewsEntry {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null; // ISO 8601 UTC；拿不到时间为 null
}

export interface SectorData {
  name: string;
  count: number;
  degraded: boolean;
  items: NewsEntry[];
}

export interface NewsData {
  schemaVersion: number;
  date: string;
  generatedAt: string;
  sectors: Record<string, SectorData>;
}

export interface DataIndex {
  schemaVersion: number;
  latest: string;
  dates: string[];
  sectorOrder: string[];
  sectorNames: Record<string, string>;
}
