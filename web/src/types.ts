// 与 scripts/fetch.mjs 输出的 JSON 结构对应（规格 6，schemaVersion 2：小时级快照）
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
  snapshotKey: string; // 如 2026-11-17T08
  date: string;
  generatedAt: string;
  sectors: Record<string, SectorData>;
}

export interface SnapshotMeta {
  key: string; // 快照 key，同时是 history/{key}.json 的文件名
  date: string; // 2026-11-17
  time: string; // 08
}

export interface DataIndex {
  schemaVersion: number;
  latest: string; // 最新快照的 key
  snapshots: SnapshotMeta[]; // 新→旧
  sectorOrder: string[];
  sectorNames: Record<string, string>;
}
