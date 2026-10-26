#!/usr/bin/env node
/**
 * galastar CLI 启动器。
 *
 * 为什么需要这一层：命令实现写在 `bin/cli.ts` 里，直接复用 `src/lib` 的
 * 数据模型与打包核心（单一事实来源）。Node 24 能原生擦除类型，但不会解析
 * tsconfig 的 `@/` 别名，也不会给无扩展名的相对导入补 `.ts`。这里用
 * `module.registerHooks` 补上这两条规则，然后动态 import 真正的入口。
 *
 * 代价是依赖 Node 的类型擦除能力；低于 24 的 Node 会在这里明确报错，
 * 而不是让内层抛出一堆看不懂的解析错误。
 */
import { registerHooks } from 'node:module'

const MIN_MAJOR = 24
const major = Number(process.versions.node.split('.')[0])
if (Number.isNaN(major) || major < MIN_MAJOR || !process.features.typescript) {
  process.stderr.write(
    `galastar 需要 Node >= ${MIN_MAJOR}（当前 ${process.version}）。\n` +
      '较新的 Node 才能原生执行 .ts；也可以用 nvm 按仓库的 .nvmrc 切换版本。\n',
  )
  process.exit(2)
}

if (typeof registerHooks !== 'function') {
  process.stderr.write('当前 Node 缺少 module.registerHooks（需要 >= 22.15 / >= 23.5）。\n')
  process.exit(2)
}

const SRC = new URL('../src/', import.meta.url)

function resolveWithExtensions(base, context, nextResolve) {
  const candidates = [base, `${base}.ts`, `${base}/index.ts`]
  let lastError = null
  for (const candidate of candidates) {
    if (candidate.endsWith('.tsx')) {
      throw new Error(`CLI 不加载 .tsx：${candidate}`)
    }
    try {
      return nextResolve(candidate, context)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error(`无法解析：${base}`)
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    /* 只接管 ESM 侧的导入；CJS 里的 require('./x') 交给 Node 自己解析，
       否则会把 jszip 这类依赖的内部相对路径改写成 file:// URL 而解析失败 */
    if (context.conditions?.includes('require')) return nextResolve(specifier, context)

    /* tsconfig paths：@/x -> src/x */
    if (specifier.startsWith('@/')) {
      return resolveWithExtensions(new URL(specifier.slice(2), SRC).href, context, nextResolve)
    }
    /* TS 生态里常把 .js 写成 .ts 的占位 */
    if (specifier.startsWith('.') && specifier.endsWith('.js')) {
      return resolveWithExtensions(
        new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL).href,
        context,
        nextResolve,
      )
    }
    /* 无扩展名的相对导入：补 .ts 或 /index.ts */
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return resolveWithExtensions(new URL(specifier, context.parentURL).href, context, nextResolve)
    }
    return nextResolve(specifier, context)
  },
})

const { main } = await import(new URL('./cli.ts', import.meta.url).href)
await main(process.argv.slice(2))
