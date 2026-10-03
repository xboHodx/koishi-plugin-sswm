import { Context } from 'koishi'

import { registerCommands } from './commands'
import { Config } from './config'
import { createRuntime } from './runtime'

export const name = 'sswm'

export { Config }

// 装配运行时状态并注册命令。
export function apply(ctx: Context, cfg: Config) {
  const runtime = createRuntime(cfg)
  registerCommands(ctx, runtime)
}
