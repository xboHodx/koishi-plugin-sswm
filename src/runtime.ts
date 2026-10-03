import type { Config } from './config'
import type { AlbumCache, AlbumInfo } from './utils/album'

// 群相册列表的内存缓存：群号 → 相册列表 + 抓取时间。
function createAlbumCache(ttlSeconds: number): AlbumCache {
  const entries = new Map<string, { albums: AlbumInfo[], stamp: number }>()
  const ttl = ttlSeconds * 1000

  return {
    read(groupId) {
      const entry = entries.get(groupId)
      if (!entry) {
        return
      }
      if (ttl > 0 && Date.now() - entry.stamp > ttl) {
        entries.delete(groupId)
        return
      }
      return entry.albums
    },
    write(groupId, albums) {
      entries.set(groupId, { albums, stamp: Date.now() })
    },
    invalidate(groupId) {
      entries.delete(groupId)
    },
  }
}

// 插件的运行时状态：配置 + 群相册缓存。
export interface RuntimeContext {
  config: Config
  albums: AlbumCache
}

export function createRuntime(config: Config): RuntimeContext {
  return {
    config,
    albums: createAlbumCache(config.albumCacheTtl ?? 600),
  }
}

// 本群是否配置过映射。
export function hasGroupConfig(config: Config, groupId: string) {
  return !!config.groups?.some(item => item.groupId === groupId)
}

// 查某个群某个 QQ 号对应的群相册名。
export function findAlbumName(config: Config, groupId: string, userId: string) {
  const group = config.groups?.find(item => item.groupId === groupId)
  return group?.bindings?.find(binding => binding.userId === userId)?.album
}
