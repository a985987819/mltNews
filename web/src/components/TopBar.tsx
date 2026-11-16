import { useEffect, useRef } from 'react';
import type { SnapshotMeta } from '../types';

interface Props {
  snapshots: SnapshotMeta[];
  snapKey: string;
  latestKey: string;
  onSnapChange: (key: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

// ISO 日期 → “11月17日”（快照下拉里直接读得懂）
function fmtLabel(s: SnapshotMeta, isLatest: boolean): string {
  const [, m, d] = s.date.split('-');
  return `${Number(m)}月${Number(d)}日 ${s.time}时${isLatest ? ' · 最新' : ''}`;
}

// 报头：印章 + 衬线品牌 + 快照选择 + 搜索 + 刷新 + 明暗切换（规格 1.2）
// 快捷键：/ 聚焦搜索，Esc 清空并退出搜索
export default function TopBar({
  snapshots,
  snapKey,
  latestKey,
  onSnapChange,
  query,
  onQueryChange,
  theme,
  onThemeToggle,
  onRefresh,
  refreshing,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (inputRef.current?.value) onQueryChange('');
      inputRef.current?.blur();
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="seal" aria-hidden="true">
            聚
          </span>
          行业热点<span className="brand-sub">聚合板</span>
        </div>
        <label className="field">
          <span className="field-label">快照</span>
          <select
            value={snapKey}
            onChange={(e) => onSnapChange(e.target.value)}
            disabled={snapshots.length === 0}
            aria-label="选择数据快照"
          >
            {snapshots.map((s) => (
              <option key={s.key} value={s.key}>
                {fmtLabel(s, s.key === latestKey)}
              </option>
            ))}
          </select>
        </label>
        <input
          ref={inputRef}
          className="search"
          type="search"
          placeholder="检索标题（按 / 聚焦）"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onInputKeyDown}
          aria-label="搜索新闻标题"
        />
        <button
          className="btn"
          onClick={onRefresh}
          disabled={refreshing}
          title="只重新读取本地 JSON，不重新抓取"
          aria-label="刷新数据"
        >
          {refreshing ? '刷新中…' : '刷新'}
        </button>
        <button
          className="btn icon"
          onClick={onThemeToggle}
          title="明暗切换"
          aria-label={theme === 'dark' ? '切换到亮色模式' : '切换到深色模式'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
