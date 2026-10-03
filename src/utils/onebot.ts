import type { Session } from 'koishi'

// 只要能按 action 名发请求就算可用的 OneBot 连接。
export interface OneBotRequester {
  _request(action: string, params: Record<string, unknown>): Promise<unknown>
}

type BotLike = {
  _request?: OneBotRequester['_request']
  internal?: {
    _request?: OneBotRequester['_request']
  }
}

// koishi-plugin-adapter-onebot 把 _request 挂在 bot.internal 上（会话里拿到的
// session.onebot 只是原始事件 payload，并没有 _request），少数实现直接挂在 bot 上。
export function resolveOneBot(bot: unknown): OneBotRequester | undefined {
  if (!bot || typeof bot !== 'object') {
    return
  }

  const direct = (bot as BotLike)._request
  if (typeof direct === 'function') {
    return { _request: direct.bind(bot) }
  }

  const internal = (bot as BotLike).internal
  const nested = internal?._request
  if (typeof nested === 'function') {
    return { _request: nested.bind(internal) }
  }
}

export function getSessionOneBot(session: Session): OneBotRequester | undefined {
  return resolveOneBot(session.bot)
}

// OneBot 的标准响应信封。
interface OneBotResponse {
  status?: string
  retcode?: number
  data?: unknown
  message?: string
  wording?: string
}

// 发一个非标准 action，并拆掉响应信封；retcode 非 0 时抛出可读的错误。
export async function callOneBot(
  onebot: OneBotRequester,
  action: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const response = await onebot._request(action, params)
  if (!response || typeof response !== 'object' || !('retcode' in response)) {
    return response
  }

  const result = response as OneBotResponse
  if (result.retcode !== 0) {
    throw new Error(result.message || result.wording || `retcode ${result.retcode}`)
  }
  return result.data
}
