/**
 * 极简参数解析。规则只有一条：`--flag` 后面跟一个不以 `-` 开头的 token 时，
 * 它是值；否则是布尔开关。够用，且不引入第三方依赖。
 */
export interface ParsedArgs {
  command: string
  positionals: string[]
  flags: Record<string, string | boolean>
}

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {}
  const positionals: string[] = []
  let command = ''

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!
    if (token === '--') {
      positionals.push(...argv.slice(i + 1))
      break
    }
    if (token.startsWith('--')) {
      const eq = token.indexOf('=')
      if (eq > 2) {
        flags[token.slice(2, eq)] = token.slice(eq + 1)
        continue
      }
      const key = token.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('-')) {
        flags[key] = next
        i += 1
      } else {
        flags[key] = true
      }
      continue
    }
    if (token === '-h') {
      flags.help = true
      continue
    }
    if (token === '-v') {
      flags.version = true
      continue
    }
    if (token.startsWith('-') && token.length > 1) {
      flags[token.slice(1)] = true
      continue
    }
    if (!command) command = token
    else positionals.push(token)
  }

  return { command, positionals, flags }
}

/** 拼错参数时立刻报错，而不是悄悄忽略 */
export function assertKnownFlags(flags: Record<string, string | boolean>, allowed: string[]) {
  const extra = Object.keys(flags).filter(
    (key) => !allowed.includes(key) && !['help', 'json', 'version'].includes(key),
  )
  if (extra.length) {
    throw new UsageError(`未知参数：${extra.map((key) => `--${key}`).join('、')}`)
  }
}

export class UsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
  }
}

export function flagString(
  flags: Record<string, string | boolean>,
  key: string,
): string | undefined {
  const value = flags[key]
  return typeof value === 'string' ? value : undefined
}

export function flagBool(flags: Record<string, string | boolean>, key: string): boolean {
  return flags[key] === true || flags[key] === 'true'
}

export function flagNumber(
  flags: Record<string, string | boolean>,
  key: string,
): number | undefined {
  const value = flagString(flags, key)
  if (value === undefined) return undefined
  const n = Number(value)
  if (!Number.isFinite(n)) throw new UsageError(`--${key} 需要一个数字，收到 ${value}`)
  return n
}
