import type { MediaSource } from './message'
import type { OneBotRequester } from './onebot'

import { callOneBot } from './onebot'

// 一个群相册。
export interface AlbumInfo {
  id: string
  name: string
}

// 查找结果：命中的相册，以及本群的全部相册（用于报错时提示可用相册）。
export interface AlbumLookup {
  album?: AlbumInfo
  albums: AlbumInfo[]
}

// 最多翻几页，避免异常响应导致死循环。
const MAX_ALBUM_PAGES = 5

// NapCat 返回 {album_id, album_name}，其它实现可能返回 {id, name}，两种都认。
function normalizeAlbums(data: unknown): AlbumInfo[] {
  const list = (data as { album_list?: unknown } | undefined)?.album_list
  if (!Array.isArray(list)) {
    return []
  }

  const albums: AlbumInfo[] = []
  for (const item of list as Record<string, unknown>[]) {
    const id = item.album_id ?? item.id
    const name = item.album_name ?? item.name
    if (typeof id === 'string' && typeof name === 'string') {
      albums.push({ id, name })
    }
  }
  return albums
}

// 拉取群相册列表（跟随分页游标）。
export async function fetchAlbums(onebot: OneBotRequester, groupId: string): Promise<AlbumInfo[]> {
  const albums: AlbumInfo[] = []
  let attachInfo = ''

  for (let page = 0; page < MAX_ALBUM_PAGES; page++) {
    const data = await callOneBot(onebot, 'get_qun_album_list', {
      group_id: groupId,
      attach_info: attachInfo,
    }) as { attach_info?: unknown, has_more?: unknown } | undefined

    albums.push(...normalizeAlbums(data))

    const next = data?.attach_info
    if (data?.has_more !== true || typeof next !== 'string' || !next || next === attachInfo) {
      break
    }
    attachInfo = next
  }

  return albums
}

// 按相册名找到相册，每次都重新拉取列表（不缓存）。
export async function resolveAlbum(
  onebot: OneBotRequester,
  groupId: string,
  albumName: string,
): Promise<AlbumLookup> {
  const albums = await fetchAlbums(onebot, groupId)
  return { album: albums.find(item => item.name === albumName), albums }
}

// 把相册名拼成一句提示。
export function formatAlbumNames(albums: AlbumInfo[]) {
  if (albums.length === 0) {
    return '（本群还没有相册，请先在 QQ 客户端里创建）'
  }
  return albums.map(item => `「${item.name}」`).join('、')
}

// 协议端没有这个接口时（老版本 NapCat / 其它实现），返回「不支持的Api xxx」。
export function isUnsupportedActionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /不支持的\s*Api|unsupported\s*action|action\s+.*not\s+found/i.test(message)
}

// NapCat 的 file 参数只认 http(s)/base64/data 和它自己进程内存在的路径；
// 媒体段没带 URL 时退回 get_image，拿到的路径就在 NapCat 侧，可以直接用。
async function resolveUploadSource(onebot: OneBotRequester, media: MediaSource) {
  if (/^(https?:|base64:|data:|file:)/i.test(media.src)) {
    return media.src
  }

  // get_image 只适用于图片；视频没有 URL 时无法取回。
  if (media.kind === 'image' && media.file) {
    const data = await callOneBot(onebot, 'get_image', { file: media.file }) as
      { file?: unknown, path?: unknown } | undefined
    const localPath = data?.file ?? data?.path
    if (typeof localPath === 'string' && localPath) {
      return localPath
    }
  }

  const label = media.kind === 'video' ? '视频' : '图片'
  throw new Error(`无法获取${label}地址（${media.src}）`)
}

// 上传一张图片到指定群相册。
export async function uploadImageToAlbum(
  onebot: OneBotRequester,
  groupId: string,
  album: AlbumInfo,
  image: MediaSource,
) {
  const file = await resolveUploadSource(onebot, image)
  await callOneBot(onebot, 'upload_image_to_qun_album', {
    group_id: groupId,
    album_id: album.id,
    album_name: album.name,
    file,
  })
}

// 一次上传多张图片：同一批在相册里显示为同一条（需要协议端支持 upload_images_to_qun_album）。
export async function uploadImagesToAlbum(
  onebot: OneBotRequester,
  groupId: string,
  album: AlbumInfo,
  images: MediaSource[],
) {
  const files: string[] = []
  for (const image of images) {
    files.push(await resolveUploadSource(onebot, image))
  }
  await callOneBot(onebot, 'upload_images_to_qun_album', {
    group_id: groupId,
    album_id: album.id,
    album_name: album.name,
    files,
  })
}

// 上传一个视频到指定群相册（封面由协议端抽取，需要 upload_video_to_qun_album）。
export async function uploadVideoToAlbum(
  onebot: OneBotRequester,
  groupId: string,
  album: AlbumInfo,
  video: MediaSource,
) {
  const file = await resolveUploadSource(onebot, video)
  await callOneBot(onebot, 'upload_video_to_qun_album', {
    group_id: groupId,
    album_id: album.id,
    album_name: album.name,
    file,
  })
}
