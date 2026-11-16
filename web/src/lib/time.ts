// 相对时间与北京时间格式化（规格 7.4.4 / 7.4.5）
export function relTime(iso: string | null): string {
  if (!iso) return '最新';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '最新';
  const diffMin = Math.floor((Date.now() - t) / 60000);
  if (diffMin < 60) return `${Math.max(1, diffMin)} 分钟前`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

export function beijingTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
