import { useEffect, useMemo, useState } from 'react';
import type { DataIndex, NewsData } from './types';
import { loadIndex, loadNewsData } from './lib/load';
import TopBar from './components/TopBar';
import SectorColumn from './components/SectorColumn';
import Footer from './components/Footer';

const THEME_KEY = 'mltnews-theme';

function initialTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* localStorage 不可用时忽略 */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export default function App() {
  const [index, setIndex] = useState<DataIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);

  // 深色模式：CSS 变量 + localStorage，默认跟随系统（规格 7.4.6）
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    loadIndex()
      .then((idx) => {
        setIndex(idx);
        setDate(idx.latest);
      })
      .catch((e) => setError(errMsg(e)));
  }, []);

  // 日期切换：latest 或 history/{date}.json，切换期间保留旧数据
  useEffect(() => {
    if (!index || !date) return;
    let alive = true;
    setLoading(true);
    loadNewsData(date, date === index.latest)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (alive) setError(errMsg(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [index, date]);

  // 刷新：只重读 JSON，不重新抓取（规格 1.2）
  const refresh = () => {
    if (!index) return;
    setLoading(true);
    loadNewsData(date || index.latest, date === index.latest, true)
      .then(setData)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  // 全局搜索：当前数据按标题过滤，空栏隐藏（规格 7.4.2）
  const filtered = useMemo(() => {
    if (!data) return null;
    const q = query.trim().toLowerCase();
    if (!q) return data.sectors;
    const out: NewsData['sectors'] = {};
    for (const [key, sec] of Object.entries(data.sectors)) {
      const items = sec.items.filter((it) => it.title.toLowerCase().includes(q));
      if (items.length === 0) continue;
      out[key] = { ...sec, items };
    }
    return out;
  }, [data, query]);

  if (error && !data) {
    return (
      <div className="fatal">
        <p>数据加载失败：{error}</p>
        <button className="btn" onClick={() => window.location.reload()}>
          重试
        </button>
      </div>
    );
  }

  const columns = filtered
    ? index
      ? [...index.sectorOrder.filter((k) => filtered[k]), ...Object.keys(filtered).filter((k) => !index.sectorOrder.includes(k))]
      : Object.keys(filtered)
    : [];

  // 规格按 7.4.3：切换到尚未加载的日期时显示骨架；同日期刷新则保留旧数据避免闪烁
  const staleDate = !data || data.date !== date;

  return (
    <div className="page">
      <TopBar
        dates={index?.dates ?? []}
        date={date}
        onDateChange={setDate}
        query={query}
        onQueryChange={setQuery}
        theme={theme}
        onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onRefresh={refresh}
        refreshing={loading}
      />
      {error && <div className="error-banner">加载失败：{error}（当前展示上次成功的数据）</div>}
      {loading && staleDate ? (
        <main className="board">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="sector skeleton">
              <div className="sk-line" style={{ width: '42%' }} />
              {Array.from({ length: 7 }, (_, j) => (
                <div key={j} className="sk-line" />
              ))}
            </div>
          ))}
        </main>
      ) : filtered && columns.length > 0 ? (
        <main className="board">
          {columns.map((key) => (
            <SectorColumn key={key} sectorKey={key} sector={filtered[key]} />
          ))}
        </main>
      ) : (
        <main className="board empty-board">
          <p className="sector-empty">{query ? `没有匹配「${query}」的新闻` : '暂无数据'}</p>
        </main>
      )}
      {data && <Footer generatedAt={data.generatedAt} />}
    </div>
  );
}
