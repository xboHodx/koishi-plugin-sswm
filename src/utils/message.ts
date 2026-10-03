import { h } from 'koishi'

// 消息里的一张图片：src 是可下载地址，file 是协议端自己的文件标识。
export interface ImageSource {
  src: string
  file: string
}

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

// 按出现顺序提取消息里的所有图片。
export function extractImageSources(content: string): ImageSource[] {
  const images: ImageSource[] = []
  for (const element of h.parse(content)) {
    if (element.type !== 'img') {
      continue
    }
    const src = element.attrs.src
    const file = element.attrs.file
    if (typeof src !== 'string' || typeof file !== 'string') {
      continue
    }
    images.push({ src, file })
  }
  return images
}
