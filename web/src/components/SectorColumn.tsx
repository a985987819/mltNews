import type { SectorData } from '../types';
import NewsItem from './NewsItem';

interface Props {
  sectorKey: string;
  sector: SectorData;
}

export default function SectorColumn({ sectorKey, sector }: Props) {
  return (
    <section className="sector">
      <header className="sector-head">
        <h2 className="sector-name">{sector.name}</h2>
        <span className="sector-count">{sector.count} 条</span>
        {sector.degraded && (
          <span className="degraded-tag" title="今日该板块抓取失败，当前展示的是此前保留的数据">
            数据可能延迟
          </span>
        )}
      </header>
      {sector.items.length === 0 ? (
        <p className="sector-empty">今日无数据</p>
      ) : (
        <ol className="sector-list">
          {sector.items.map((item, i) => (
            <NewsItem key={`${sectorKey}-${i}`} item={item} rank={i + 1} />
          ))}
        </ol>
      )}
    </section>
  );
}
