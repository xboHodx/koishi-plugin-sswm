import { Context, h } from 'koishi'

import type { RuntimeContext } from '../runtime'
import type { AlbumInfo } from '../utils/album'
import type { MediaSource } from '../utils/message'
import type { OneBotRequester } from '../utils/onebot'

import { describeBindings, findAlbumName, hasGroupConfig } from '../runtime'
import {
  formatAlbumNames,
  isUnsupportedActionError,
  resolveAlbum,
  uploadImageToAlbum,
  uploadImagesToAlbum,
  uploadVideoToAlbum,
} from '../utils/album'
import { ensureSession } from '../utils/argv'
import { extractMediaSources, extractSingleAtId } from '../utils/message'
import { getSessionOneBot } from '../utils/onebot'

interface UploadResult {
  images: number
  videos: number
  failures: string[]
}

// 图片：一张走单图接口，多张走批量接口（相册里同一条）；协议端不支持批量时逐张回退。
async function uploadImages(
  onebot: OneBotRequester,
  groupId: string,
  album: AlbumInfo,
  images: MediaSource[],
  onProgress: (index: number, ms: number, error?: string) => void,
): Promise<{ ok: number, failures: string[] }> {
  const failures: string[] = []

  if (images.length === 1) {
    const started = Date.now()
    try {
      await uploadImageToAlbum(onebot, groupId, album, images[0])
      onProgress(1, Date.now() - started)
      return { ok: 1, failures }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      onProgress(1, Date.now() - started, reason)
      return { ok: 0, failures: [reason] }
    }
  }

  const started = Date.now()
  try {
    await uploadImagesToAlbum(onebot, groupId, album, images)
    onProgress(images.length, Date.now() - started)
    return { ok: images.length, failures }
  } catch (error) {
    if (!isUnsupportedActionError(error)) {
      const reason = error instanceof Error ? error.message : String(error)
      failures.push(reason)
      return { ok: 0, failures }
    }
    // 老版本协议端没有批量接口：逐张传，行为退回改动前
    onProgress(0, Date.now() - started, '协议端不支持批量上传，改为逐张上传')
  }

  let ok = 0
  for (const [index, image] of images.entries()) {
    const each = Date.now()
    try {
      await uploadImageToAlbum(onebot, groupId, album, image)
      ok += 1
      onProgress(index + 1, Date.now() - each)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      failures.push(reason)
      onProgress(index + 1, Date.now() - each, reason)
    }
  }
  return { ok, failures }
}

// 注册 sswm 命令：把引用的图片/视频上传到群相册。
export function registerSswmCommand(ctx: Context, runtime: RuntimeContext) {
  const config = runtime.config
  const logger = ctx.logger('sswm')

  ctx.command('sswm [target:string]', '把引用的图片或视频上传到群相册')
    .usage('引用一条包含图片/视频的消息，发送 sswm 即可上传到发送者的群相册\n加上 @某人 可以上传到对方的群相册\n同一批的多张图片会合并成相册里的一条')
    .example('sswm')
    .example('sswm @某人')
    .action(async (argv, target) => {
      const session = ensureSession(argv)
      const groupId = session.guildId
      if (groupId == null) {
        return '只能在群聊中使用'
      }
      if (!hasGroupConfig(config, groupId)) {
        return '本群还没有配置群相册映射，请先在插件配置里添加'
      }

      // 没有引用可上传的媒体时，按配置决定是静默还是提示（返回空值不会发出任何消息）。
      const quote = session.quote
      if (quote == null) {
        return config.silentWithoutImage ? undefined : '你必须引用一条包含图片或视频的消息'
      }

      const media = extractMediaSources(quote.content ?? '')
      if (media.length === 0) {
        return config.silentWithoutImage ? undefined : '引用的消息里没有图片或视频'
      }
      const images = media.filter(item => item.kind === 'image')
      const videos = media.filter(item => item.kind === 'video')

      // 第一个参数是 @ 就用被 @ 的人，否则用被引用消息的发送者。
      const atId = target ? extractSingleAtId(target) : undefined
      const userId = atId ?? quote.user?.id
      if (!userId) {
        return '被引用的消息里没有发送者信息，请用 @某人 指定'
      }

      const albumName = findAlbumName(config, groupId, userId)
      if (!albumName) {
        return h('p', h.at(userId), ` 在本群还没有配置群相册（本群已配置：${describeBindings(config, groupId)}）`)
      }

      const onebot = getSessionOneBot(session)
      if (!onebot) {
        return '当前连接不支持调用 OneBot 相册接口，请检查适配器'
      }

      let album
      try {
        const lookup = await resolveAlbum(onebot, groupId, albumName)
        album = lookup.album
        if (!album) {
          return `群相册「${albumName}」不存在，本群可用相册：${formatAlbumNames(lookup.albums)}`
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        return `获取群相册列表失败：${reason}`
      }

      // 上传可能要几十秒（大图/视频），先回执，再放到后台传，避免群里干等。
      const describe = [
        images.length ? `${images.length} 张图片` : '',
        videos.length ? `${videos.length} 个视频` : '',
      ].filter(Boolean).join(' 和 ')

      const batchStarted = Date.now()
      logger.info(`开始上传 ${describe} 到群相册「${albumName}」（${album.id}）`)

      void (async () => {
        const result: UploadResult = { images: 0, videos: 0, failures: [] }
        const logProgress = (label: string) => (index: number, ms: number, error?: string) => {
          if (error) {
            logger.warn(`${label} ${index} 失败（${ms}ms）：${error}`)
          } else {
            logger.info(`${label} ${index} 成功（${ms}ms）`)
          }
        }

        if (images.length) {
          const outcome = await uploadImages(onebot, groupId, album, images, logProgress('图片'))
          result.images = outcome.ok
          result.failures.push(...outcome.failures)
        }
        for (const [index, video] of videos.entries()) {
          const started = Date.now()
          try {
            await uploadVideoToAlbum(onebot, groupId, album, video)
            result.videos += 1
            logProgress('视频')(index + 1, Date.now() - started)
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            result.failures.push(reason)
            logProgress('视频')(index + 1, Date.now() - started, reason)
          }
        }

        logger.info(`本批完成：图片 ${result.images}/${images.length}，视频 ${result.videos}/${videos.length}，总用时 ${Date.now() - batchStarted}ms`)

        const done = [
          result.images ? `${result.images} 张图片` : '',
          result.videos ? `${result.videos} 个视频` : '',
        ].filter(Boolean).join(' 和 ')

        try {
          // 失败一律要在群里说清楚（replyResult 只管成功的那条）
          if (!done) {
            await session.send(`上传到群相册「${albumName}」失败：${result.failures[0] ?? '未知错误'}`)
          } else if (result.failures.length > 0) {
            const rest = config.replyResult ? `（其余 ${done}已上传）` : ''
            await session.send(h('p', h.at(userId), ` 上传到群相册「${albumName}」时有 ${result.failures.length} 项失败：${result.failures[0]}${rest}`))
          } else if (config.replyResult) {
            await session.send(h('p', h.at(userId), ` 的 ${done}已上传到群相册「${albumName}」`))
          }
        } catch (error) {
          logger.warn(`回传上传结果失败：${error instanceof Error ? error.message : String(error)}`)
        }
      })()

      // 回执也可以在配置里关掉（返回空值不会发出任何消息，上传照常在后台进行）
      return config.replyUploading ? `正在上传 ${describe} 到群相册「${albumName}」…` : undefined
    })
}
