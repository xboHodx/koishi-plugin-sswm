import type { Context } from 'koishi'
import type { RuntimeContext } from '../runtime'

import { registerSswmCommand } from './sswm'

// 注册全部命令。
export function registerCommands(ctx: Context, runtime: RuntimeContext) {
  registerSswmCommand(ctx, runtime)
}

export { registerSswmCommand }
