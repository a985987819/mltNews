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
  return 'light'; // 白色主题为默认，深色可手动切换并记忆
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
  const [, setTick] = useState(0); // 每分钟自增一次，驱动相对时间重新渲染

  // 深色模式：CSS 变量 + localStorage，默认跟随系统（规格 7.4.6）
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // 首屏：index 与 latest 并行加载（latest 永远是默认视图，不必等 index 返回再发第二次请求）
  useEffect(() => {
    let alive = true;
    loadIndex()
      .then((idx) => {
        if (alive) {
          setIndex(idx);
          setDate(idx.latest);
        }
      })
      .catch((e) => {
        if (alive) setError(errMsg(e));
      });
    loadNewsData('', true)
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
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
  }, []);

  // 日期切换：目标日期已在展示则跳过（避免重复加载与闪烁），否则读缓存/网络（规格 7.4.3）
  useEffect(() => {
    if (!index || !date || (data && data.date === date)) return;
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
  }, [index, date, data]);

  // 相对时间（“X 分钟前”）每分钟自动刷新
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 60000);
    return () => window.clearInterval(t);
  }, []);

  // 顶部栏实际高度写入 CSS 变量，供栏头吸顶定位使用（窄屏换行后高度会变）
  useEffect(() => {
    const setVar = () => {
      const h = document.querySelector('.topbar')?.getBoundingClientRect().height ?? 52;
      document.documentElement.style.setProperty('--topbar-h', `${Math.round(h)}px`);
    };
    setVar();
    window.addEventListener('resize', setVar);
    return () => window.removeEventListener('resize', setVar);
  }, []);

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

  const matchCount = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !data) return 0;
    return Object.values(data.sectors).reduce(
      (n, s) => n + s.items.filter((it) => it.title.toLowerCase().includes(q)).length,
      0,
    );
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
  const searching = query.trim().length > 0;

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
      {searching && matchCount > 0 && (
        <div className="search-info">
          找到 {matchCount} 条匹配「{query.trim()}」，按 Esc 清空
        </div>
      )}
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
            <SectorColumn key={key} sectorKey={key} sector={filtered[key]} query={query} />
          ))}
        </main>
      ) : (
        <main className="board empty-board">
          <p className="sector-empty">{searching ? `没有匹配「${query.trim()}」的新闻` : '暂无数据'}</p>
        </main>
      )}
      {data && <Footer generatedAt={data.generatedAt} />}
    </div>
  );
}
