import assert from 'node:assert/strict'
import test from 'node:test'

import type { Config } from '../src/config'

import { createRuntime, findAlbumName, hasGroupConfig } from '../src/runtime'
import { fetchAlbums, resolveAlbum, uploadImageToAlbum } from '../src/utils/album'
import { extractImageSources, extractSingleAtId } from '../src/utils/message'
import { callOneBot, type OneBotRequester } from '../src/utils/onebot'

interface RecordedCall {
  action: string
  params: Record<string, unknown>
}

// 假 OneBot 连接：记录每次请求，并按 handler 返回给定的响应信封。
function createFakeOneBot(
  handler: (action: string, params: Record<string, unknown>) => unknown,
): { onebot: OneBotRequester, calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  return {
    calls,
    onebot: {
      async _request(action, params) {
        calls.push({ action, params })
        return handler(action, params)
      },
    },
  }
}

function createConfig(overrides: Partial<Config> = {}): Config {
  return {
    groups: [{
      groupId: '100',
      bindings: [
        { userId: '1', album: '小明' },
        { userId: '2', album: '小红' },
      ],
    }],
    albumCacheTtl: 600,
    ...overrides,
  }
}

const ok = (data: unknown) => ({ status: 'ok', retcode: 0, data })
const fail = (retcode: number, message: string) => ({ status: 'failed', retcode, data: null, message })

test('extractImageSources 按顺序取出图片', () => {
  const content = '<img src="https://example.com/1.jpg" file="1.jpg"/>文字<img src="https://example.com/2.png" file="2.png"/>'

  assert.deepEqual(extractImageSources(content), [
    { src: 'https://example.com/1.jpg', file: '1.jpg' },
    { src: 'https://example.com/2.png', file: '2.png' },
  ])
})

test('extractImageSources 忽略没有 src/file 的图片', () => {
  assert.deepEqual(extractImageSources('<img src="https://example.com/1.jpg"/>'), [])
})

test('extractSingleAtId 只接受单独一段 at', () => {
  assert.equal(extractSingleAtId('<at id="42"/>'), '42')
  assert.equal(extractSingleAtId('<at id="42"/>文字'), undefined)
  assert.equal(extractSingleAtId('文字'), undefined)
})

test('findAlbumName 按群和 QQ 号取相册名', () => {
  const config = createConfig()

  assert.equal(findAlbumName(config, '100', '1'), '小明')
  assert.equal(findAlbumName(config, '100', '2'), '小红')
  assert.equal(findAlbumName(config, '100', '3'), undefined)
  assert.equal(findAlbumName(config, '999', '1'), undefined)
  assert.equal(hasGroupConfig(config, '100'), true)
  assert.equal(hasGroupConfig(config, '999'), false)
})

test('callOneBot 拆信封并保留 data', async () => {
  const { onebot } = createFakeOneBot(() => ok({ album_list: [] }))

  assert.deepEqual(await callOneBot(onebot, 'get_qun_album_list', { group_id: '100' }), { album_list: [] })
})

test('callOneBot 在 retcode 非 0 时抛出可读错误', async () => {
  const { onebot } = createFakeOneBot(() => fail(1404, '资源不存在'))

  await assert.rejects(
    () => callOneBot(onebot, 'upload_image_to_qun_album', {}),
    /资源不存在/,
  )
})

test('fetchAlbums 兼容两种字段名并跟随分页', async () => {
  const { onebot, calls } = createFakeOneBot((_action, params) => {
    if (params.attach_info === '') {
      return ok({
        album_list: [{ album_id: 'a1', album_name: '小明' }],
        attach_info: 'next',
        has_more: true,
      })
    }
    return ok({
      album_list: [{ id: 'a2', name: '小红' }],
      attach_info: '',
      has_more: false,
    })
  })

  assert.deepEqual(await fetchAlbums(onebot, '100'), [
    { id: 'a1', name: '小明' },
    { id: 'a2', name: '小红' },
  ])
  assert.equal(calls.length, 2)
  assert.equal(calls[1].params.attach_info, 'next')
})

test('resolveAlbum 命中缓存，失效后重新拉取', async () => {
  const runtime = createRuntime(createConfig())
  const { onebot, calls } = createFakeOneBot(() => ok({
    album_list: [{ album_id: 'a1', album_name: '小明' }],
    attach_info: '',
    has_more: false,
  }))

  const first = await resolveAlbum(onebot, '100', '小明', runtime.albums)
  assert.equal(first.album?.id, 'a1')

  const second = await resolveAlbum(onebot, '100', '小明', runtime.albums)
  assert.equal(second.album?.id, 'a1')
  assert.equal(calls.length, 1)

  runtime.albums.invalidate('100')
  await resolveAlbum(onebot, '100', '小明', runtime.albums)
  assert.equal(calls.length, 2)
})

test('resolveAlbum 未命中时返回本群全部相册', async () => {
  const runtime = createRuntime(createConfig())
  const { onebot } = createFakeOneBot(() => ok({
    album_list: [{ album_id: 'a1', album_name: '小明' }],
    attach_info: '',
    has_more: false,
  }))

  const lookup = await resolveAlbum(onebot, '100', '不存在的相册', runtime.albums)

  assert.equal(lookup.album, undefined)
  assert.deepEqual(lookup.albums, [{ id: 'a1', name: '小明' }])
})

test('uploadImageToAlbum 发送图片 URL 与四个必填参数', async () => {
  const { onebot, calls } = createFakeOneBot(() => ok(null))

  await uploadImageToAlbum(
    onebot,
    '100',
    { id: 'a1', name: '小明' },
    { src: 'https://example.com/1.jpg', file: '1.jpg' },
  )

  assert.deepEqual(calls, [{
    action: 'upload_image_to_qun_album',
    params: {
      group_id: '100',
      album_id: 'a1',
      album_name: '小明',
      file: 'https://example.com/1.jpg',
    },
  }])
})

test('uploadImageToAlbum 在 src 不是地址时退回 get_image 拿本地路径', async () => {
  const { onebot, calls } = createFakeOneBot((action) => {
    if (action === 'get_image') {
      return ok({ file: '/app/napcat/temp/1.jpg' })
    }
    return ok(null)
  })

  await uploadImageToAlbum(
    onebot,
    '100',
    { id: 'a1', name: '小明' },
    { src: '6B4DE3DF.jpg', file: '6B4DE3DF.jpg' },
  )

  assert.deepEqual(calls[0], { action: 'get_image', params: { file: '6B4DE3DF.jpg' } })
  assert.equal(calls[1].params.file, '/app/napcat/temp/1.jpg')
})

test('uploadImageToAlbum 拿不到地址时报错', async () => {
  const { onebot } = createFakeOneBot(() => ok(null))

  await assert.rejects(
    () => uploadImageToAlbum(onebot, '100', { id: 'a1', name: '小明' }, { src: '6B4DE3DF.jpg', file: '' }),
    /无法获取图片地址/,
  )
})
