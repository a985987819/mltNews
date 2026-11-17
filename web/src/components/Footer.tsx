import { beijingTime } from '../lib/time';

// 页脚：数据来源说明 + 免责声明 + 最后构建时间（规格 1.2 / 13）
export default function Footer({ generatedAt }: { generatedAt?: string }) {
  return (
    <footer className="site-footer">
      <p>
        数据来源：NewsNow 公开接口（澎湃新闻、财联社、华尔街见闻、36氪、掘金、V2EX、FreeBuf
        等）、光纤在线、中国工程机械工业协会。数据每小时整点由 GitHub Actions 自动抓取更新，
        静态列表页每 8 小时刷新一次。
      </p>
      <p>
        本站仅聚合各媒体公开发布的新闻标题与链接，所有内容版权归原作者及原媒体所有。点击标题将跳转至原始来源。本站不做内容存储与再分发，如有异议请联系删除。
      </p>
      {generatedAt && <p className="build-time">最后构建时间：{beijingTime(generatedAt)}（北京时间）</p>}
    </footer>
  );
}
