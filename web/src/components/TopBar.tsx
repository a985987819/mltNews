interface Props {
  dates: string[];
  date: string;
  onDateChange: (d: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

// 顶部工具条：日期选择 + 搜索 + 刷新（只重读 JSON）+ 明暗切换（规格 1.2）
export default function TopBar({
  dates,
  date,
  onDateChange,
  query,
  onQueryChange,
  theme,
  onThemeToggle,
  onRefresh,
  refreshing,
}: Props) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          行业热点<span>聚合板</span>
        </div>
        <label className="field">
          <span className="field-label">日期</span>
          <select value={date} onChange={(e) => onDateChange(e.target.value)} disabled={dates.length === 0}>
            {dates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <input
          className="search"
          type="search"
          placeholder="在当前数据中搜索标题…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <button className="btn" onClick={onRefresh} disabled={refreshing} title="只重新读取本地 JSON，不重新抓取">
          {refreshing ? '刷新中…' : '刷新'}
        </button>
        <button className="btn icon" onClick={onThemeToggle} title="明暗切换">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
