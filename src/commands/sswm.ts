import { Context, h } from 'koishi'

import type { RuntimeContext } from '../runtime'

import { findAlbumName, hasGroupConfig } from '../runtime'
import { formatAlbumNames, resolveAlbum, uploadImageToAlbum } from '../utils/album'
import { ensureSession } from '../utils/argv'
import { extractImageSources, extractSingleAtId } from '../utils/message'
import { getSessionOneBot } from '../utils/onebot'

// 注册 sswm 命令：把引用的图片上传到群相册。
export function registerSswmCommand(ctx: Context, runtime: RuntimeContext) {
  const config = runtime.config

  ctx.command('sswm [target:string]', '把引用的图片上传到群相册')
    .usage('引用一条包含图片的消息，发送 sswm 即可上传到图片发送者的群相册\n加上 @某人 可以上传到对方的群相册')
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

      const quote = session.quote
      if (quote == null) {
        return '你必须引用一条包含图片的消息'
      }

      const images = extractImageSources(quote.content ?? '')
      if (images.length === 0) {
        return '引用的消息里没有图片'
      }

      // 没有 @ 时用图片发送者，@ 了就用被 @ 的人。
      let userId = quote.user?.id
      if (target) {
        const atId = extractSingleAtId(target)
        if (!atId) {
          return '请使用 @某人 的形式指定目标'
        }
        userId = atId
      }
      if (!userId) {
        return '无法确定图片发送者，请用 @某人 指定'
      }

      const albumName = findAlbumName(config, groupId, userId)
      if (!albumName) {
        return h('p', h.at(userId), ' 在本群没有配置群相册')
      }

      const onebot = getSessionOneBot(session)
      if (!onebot) {
        return '当前连接不支持调用 OneBot 相册接口，请检查适配器'
      }

      try {
        const lookup = await resolveAlbum(onebot, groupId, albumName, runtime.albums)
        const album = lookup.album
        if (!album) {
          return `群相册「${albumName}」不存在，本群可用相册：${formatAlbumNames(lookup.albums)}`
        }

        let success = 0
        const failures: string[] = []

        // 引用的消息里有几张图就传几张。
        for (const image of images) {
          try {
            await uploadImageToAlbum(onebot, groupId, album, image)
            success += 1
          } catch (error) {
            // 上传失败可能是因为缓存的相册信息过期，下次重新拉取列表。
            runtime.albums.invalidate(groupId)
            failures.push(error instanceof Error ? error.message : String(error))
          }
        }

        if (success === 0) {
          return `上传到群相册「${albumName}」失败：${failures[0] ?? '未知错误'}`
        }
        if (failures.length > 0) {
          return h('p', h.at(userId), ` 的 ${success} 张图片已上传到群相册「${albumName}」，另有 ${failures.length} 张失败：${failures[0]}`)
        }
        return h('p', h.at(userId), ` 的 ${success} 张图片已上传到群相册「${albumName}」`)
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        return `获取群相册列表失败：${reason}`
      }
    })
}
