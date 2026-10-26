import { defineConfig } from 'vite-plus'
import type { PluginOption } from 'vite-plus'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import pkg from './package.json'

// 本地开发与预览恒为根路径；
// CI 注入 PAGES_BASE_PATH 决定线上前缀：项目页 /<repo>/，自定义域或用户页 /
// 代码不做任何域名或仓库名推断
const base = process.env.PAGES_BASE_PATH || '/'

// @vitejs/plugin-react 与 vite-plus 各自携带一份 vite 类型，
// 结构等价但类型实例不同，这里做一次显式收敛，避免 TS 递归比较过深
const reactPlugin = react() as unknown as PluginOption

export default defineConfig({
  base,
  plugins: [reactPlugin],
  // 界面上的版本号只认 package.json，不手写
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
  fmt: { semi: false, singleQuote: true },
  lint: {
    // 必须显式排除，否则 vp lint 会扫描 node_modules；
    // public/engine 是零依赖的纯 JS 播放器运行时，由构建期原样拷贝，不参与 TS 检查
    ignorePatterns: ['node_modules/**', 'dist/**', 'public/engine/**'],
    options: { typeAware: true, typeCheck: true },
  },
})
