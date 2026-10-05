# koishi-plugin-sswm

引用一条群友发的消息，把它里面的图片/视频上传到对应的 QQ 群相册。每个群一份「QQ 号 → 群相册名」映射，默认传到消息发送者的相册，也可以 @某人 指定。

## 前提

- **相册必须已经存在**。群相册只能人工在 QQ 客户端里创建，OneBot 侧没有创建相册的接口（NapCat 全系都没有），插件只负责往已有相册里传。
- 需要协议端支持群相册扩展接口。已在 **NapCat** 上设计：
  - `get_qun_album_list` / `upload_image_to_qun_album`：基础能力
  - `upload_images_to_qun_album`：多图合并为相册里同一条（NapCat PR [#2081](https://github.com/NapNeko/NapCatQQ/pull/2081)，未合并前需自建）
  - `upload_video_to_qun_album`：视频上传（同上）
- 老版本 NapCat 上没有后两个接口时：多图会**自动回退成逐张上传**，视频会报「不支持该接口」。
- 相册名要和 QQ 里显示的完全一致。

## 配置

```yaml
sswm:
  groups:
    - groupId: '2161015335'
      bindings:
        - userId: '1738832489'
          album: 小明
        - userId: '2679933924'
          album: 小红
  silentWithoutImage: false
  replyUploading: true
  replyResult: true
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `groups[].groupId` | string | — | 群号 |
| `groups[].bindings[].userId` | string | — | QQ 号 |
| `groups[].bindings[].album` | string | — | 群相册名（对应群里的相册标题） |
| `silentWithoutImage` | boolean | `false` | 没有引用可上传的媒体（图片/视频）时静默失败（不回复任何提示） |
| `replyUploading` | boolean | `true` | 回执「正在上传 N 张图片…」；关掉后命令不回复，上传照常进行 |
| `replyResult` | boolean | `true` | **上传成功时**回报结果；关掉后成功不回复，**失败一律会在群里说** |

两个开关可以随意组合，例如「不要回执、只在成功时报一句」：`replyUploading: false` + `replyResult: true`。

无论怎么配置，**失败永远会在群里说**（`replyResult` 只影响成功那条），例如：

```
@某人 上传到群相册「水哥」时有 1 项失败：视频上传完成但未取得 sVid，无法挂进相册（其余 2 张图片已上传）
```

## 命令

```
/sswm            # 上传到「被引用消息的发送者」在本群配置的相册
/sswm @某人      # 上传到被 @ 的人在本群配置的相册
```

用法：先**引用一条包含图片或视频的消息**，再发送命令。命令所在的消息本身不需要带图。

- 没 @ 时用被引用消息的发送者，@ 了就用被 @ 的人。
- 目标人没有配置相册，会提示 `@某人 在本群没有配置群相册`。
- 配置的相册名在本群找不到时，会列出本群所有可用相册名，方便核对拼写。
- **多张图片合并为相册里的一条**（走批量接口）；**视频逐个上传**，封面由协议端抽首帧。
- 引用消息里同时有图片和视频时：图片合成一条，每个视频各成一条（协议端不支持图文混批）。
- 没有引用、或引用的消息里没有图片/视频时：默认给出提示，`silentWithoutImage` 打开后静默不回复。
- 命令会**立刻回执**「正在上传 N 张图片 和 M 个视频…」，实际上传在后台进行，完成后另发一条结果消息（回执与成功结果可用 `replyUploading` / `replyResult` 关掉，失败消息不受开关影响）。

> 失败的项会在结果消息里说明，日志里也有逐项耗时（`docker logs ... | grep sswm`）。

## 实现说明

- 相册名 → `album_id`：调用 `get_qun_album_list` 拉取本群相册列表后按名字匹配，**不缓存**，每次命令都重新拉取。
- 上传接口：
  - 单张图片 → `upload_image_to_qun_album`（`group_id` / `album_id` / `album_name` / `file`）
  - 多张图片 → `upload_images_to_qun_album`（把 `file` 换成 `files` 数组）
  - 视频 → `upload_video_to_qun_album`（单文件，封面由 NapCat 抽帧）
- `file` 优先用消息里的 URL，让协议端自己下载；图片段没有 URL 时退回 `get_image` 取协议端侧的本地路径（视频没有 URL 则直接报错，不会误用 `get_image`）。
- 批量接口报「不支持的Api」时自动回退为逐张 `upload_image_to_qun_album`，行为与老版本一致。
- 接口调用走 `bot.internal._request`（`koishi-plugin-adapter-onebot` 把 `_request` 挂在 `bot.internal` 上，`session.onebot` 只是原始事件 payload），并自行判断 `retcode`。

## 开发

```bash
# 类型检查 + 声明文件
npx tsc -p tsconfig.json

# 构建 lib/index.js
npm run build

# 单元测试
npm test
```
