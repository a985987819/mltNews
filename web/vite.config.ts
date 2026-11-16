import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 部署在 https://a985987819.github.io/mltNews/ ，base 必须带仓库名（规格 8.3，坑 #1）
  base: '/mltNews/',
});
