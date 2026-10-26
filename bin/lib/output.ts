/** CLI 的输出信封：--json 时 stdout 只有一个对象，其余全都走 stderr */
import { cliVersion } from './paths'

export class CliError extends Error {
  code: string
  exitCode: number
  hint?: string
  path?: string
  data?: unknown

  constructor(
    code: string,
    message: string,
    opts: { exitCode?: number; hint?: string; path?: string; data?: unknown } = {},
  ) {
    super(message)
    this.name = 'CliError'
    this.code = code
    this.exitCode = opts.exitCode ?? 1
    this.hint = opts.hint
    this.path = opts.path
    this.data = opts.data
  }
}

export interface Envelope {
  ok: boolean
  command: string
  schema: 1
  version: string
  durationMs: number
  data?: unknown
  issues?: unknown[]
  warnings?: unknown[]
  error?: { code: string; message: string; hint?: string; path?: string }
}

export class Reporter {
  readonly json: boolean
  readonly command: string
  private readonly startedAt = Date.now()

  constructor(command: string, json: boolean) {
    this.command = command
    this.json = json
  }

  /** 人类可读输出；--json 时改走 stderr，保证 stdout 干净 */
  log(message = '') {
    const stream = this.json ? process.stderr : process.stdout
    stream.write(`${message}\n`)
  }

  note(message: string) {
    process.stderr.write(`${message}\n`)
  }

  ok(data: unknown, extra: { issues?: unknown[]; warnings?: unknown[] } = {}) {
    if (!this.json) return
    this.write({
      ok: true,
      command: this.command,
      schema: 1,
      version: cliVersion(),
      durationMs: Date.now() - this.startedAt,
      data,
      ...extra,
    })
  }

  fail(error: unknown) {
    const normalized =
      error instanceof CliError
        ? error
        : new CliError('E_INTERNAL', error instanceof Error ? error.message : String(error), {
            exitCode: 1,
          })
    if (this.json) {
      this.write({
        ok: false,
        command: this.command,
        schema: 1,
        version: cliVersion(),
        durationMs: Date.now() - this.startedAt,
        error: {
          code: normalized.code,
          message: normalized.message,
          ...(normalized.hint ? { hint: normalized.hint } : {}),
          ...(normalized.path ? { path: normalized.path } : {}),
        },
        ...(normalized.data !== undefined ? { data: normalized.data } : {}),
      })
    } else {
      process.stderr.write(`错误 ${normalized.code}：${normalized.message}\n`)
      if (normalized.path) process.stderr.write(`  位置：${normalized.path}\n`)
      if (normalized.hint) process.stderr.write(`  提示：${normalized.hint}\n`)
    }
    process.exitCode = normalized.exitCode
  }

  private write(envelope: Envelope) {
    process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`)
  }
}
