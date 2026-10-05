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
}

export const Config: Schema<Config> = Schema.object({
  groups: Schema.array(Schema.object({
    groupId: Schema.string().required().description('群号'),
    bindings: Schema.array(Schema.object({
      userId: Schema.string().required().description('QQ 号'),
      album: Schema.string().required().description('群相册名'),
    })).role('table').description('QQ 号 → 群相册名'),
  })).role('table').description('每个群一组「QQ 号 → 群相册名」映射'),
})
