import type { Argv, Session } from 'koishi'

// 确保命令参数里存在可用的 session。
export function ensureSession(argv: Argv): Session {
  if (!argv.session) {
    throw new Error('session is required for this command path')
  }
  return argv.session
}
