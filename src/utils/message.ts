import { h } from 'koishi'

// 消息里的一份媒体：src 是可下载地址，file 是协议端自己的文件标识。
export interface MediaSource {
  src: string
  file: string
  kind: MediaKind
}

export type MediaKind = 'image' | 'video'

// 图片沿用旧名字，保持既有调用方与测试可用。
export type ImageSource = MediaSource

// 只接受单独存在的一段 @ 提及。
export function extractSingleAtId(input: string) {
  const elements = h.parse(input)
  if (elements.length !== 1 || elements[0].type !== 'at') {
    return
  }
  const id = elements[0].attrs.id
  if (typeof id !== 'string') {
    return
  }
  return id
}

// 按出现顺序提取消息里的图片与视频。
export function extractMediaSources(content: string): MediaSource[] {
  const media: MediaSource[] = []
  for (const element of h.parse(content)) {
    const kind: MediaKind | undefined = element.type === 'img'
      ? 'image'
      : element.type === 'video' ? 'video' : undefined
    if (!kind) {
      continue
    }

    const src = element.attrs.src
    const file = element.attrs.file
    if (typeof src === 'string' && src) {
      media.push({ src, file: typeof file === 'string' ? file : '', kind })
    } else if (typeof file === 'string' && file) {
      media.push({ src: file, file, kind })
    }
  }
  return media
}

// 只取图片（引用消息里可能既有图也有视频）。
export function extractImageSources(content: string): ImageSource[] {
  return extractMediaSources(content).filter(item => item.kind === 'image')
}
