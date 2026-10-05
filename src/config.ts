import { Schema } from 'koishi'

// 一条「QQ 号 → 群相册名」的映射。
export interface AlbumBinding {
  userId: string
  album: string
}

// 一个群对应的一组映射。
export interface GroupBindings {
  groupId: string
  bindings: AlbumBinding[]
}

// 插件的用户可配置项。
export interface Config {
  groups: GroupBindings[]
  silentWithoutImage: boolean
  replyUploading: boolean
  replyResult: boolean
}

export const Config: Schema<Config> = Schema.object({
  groups: Schema.array(Schema.object({
    groupId: Schema.string().required().description('群号'),
    bindings: Schema.array(Schema.object({
      userId: Schema.string().required().description('QQ 号'),
      album: Schema.string().required().description('群相册名'),
    })).role('table').description('QQ 号 → 群相册名'),
  })).role('table').description('每个群一组「QQ 号 → 群相册名」映射'),
  silentWithoutImage: Schema.boolean()
    .default(false)
    .description('没有引用可上传的媒体（图片/视频）时静默失败（不回复任何提示）'),
  replyUploading: Schema.boolean()
    .default(true)
    .description('回执「正在上传 N 张图片…」（关掉后命令不回复，上传照常进行）'),
  replyResult: Schema.boolean()
    .default(true)
    .description('上传成功时回报结果（关掉后成功不回复；失败一律会在群里说）'),
})
