import type { NewsEntry } from '../types';
import { relTime } from '../lib/time';

interface Props {
  item: NewsEntry;
  rank: number;
  query: string;
}

// 搜索时高亮标题中的命中片段（不区分大小写，只标第一处）
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

// 点击整条 → 新标签页打开原始来源；rel 必须带（规格 7.4.1）
// title 属性让两行截断的标题在悬浮时显示全文
export default function NewsItem({ item, rank, query }: Props) {
  return (
    <li className="news-item">
      <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.title}>
        <span className={`rank${rank <= 3 ? ` top-${rank}` : ''}`}>{rank}</span>
        <span className="item-main">
          <span className="item-title">
            <Highlight text={item.title} query={query} />
          </span>
          <span className="item-meta">
            {item.source} · {relTime(item.publishedAt)}
          </span>
        </span>
      </a>
    </li>
  );
}
