import type { NewsEntry } from '../types';
import { relTime } from '../lib/time';

interface Props {
  item: NewsEntry;
  rank: number;
}

// 点击整条 → 新标签页打开原始来源；rel 必须带（规格 7.4.1）
export default function NewsItem({ item, rank }: Props) {
  return (
    <li className="news-item">
      <a href={item.url} target="_blank" rel="noopener noreferrer">
        <span className={`rank${rank <= 3 ? ` top-${rank}` : ''}`}>{rank}</span>
        <span className="item-main">
          <span className="item-title">{item.title}</span>
          <span className="item-meta">
            {item.source} · {relTime(item.publishedAt)}
          </span>
        </span>
      </a>
    </li>
  );
}
