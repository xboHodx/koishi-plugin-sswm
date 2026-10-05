# koishi-plugin-sswm

引用一张群友发的图片，把它上传到对应的 QQ 群相册。每个群一份「QQ 号 → 群相册名」映射，默认传到图片发送者的相册，也可以 @某人 指定。

## 前提

- **相册必须已经存在**。群相册只能人工在 QQ 客户端里创建，OneBot 侧没有创建相册的接口（NapCat 全系都没有），插件只负责往已有相册里传图。
- 需要协议端支持群相册扩展接口。已在 **NapCat** 上设计（`get_qun_album_list` / `upload_image_to_qun_album`），其它实现不保证。
- 只支持图片，**不支持视频**（NapCat 没有相册视频接口）。
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
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `groups[].groupId` | string | — | 群号 |
| `groups[].bindings[].userId` | string | — | QQ 号 |
| `groups[].bindings[].album` | string | — | 群相册名（对应群里的相册标题） |

## 命令

```
/sswm            # 上传到「图片发送者」在本群配置的相册
/sswm @某人      # 上传到被 @ 的人在本群配置的相册
```

用法：先**引用一条包含图片的消息**，再发送命令。命令所在的消息本身不需要带图。

- 没 @ 时用被引用消息的发送者，@ 了就用被 @ 的人。
- 目标人没有配置相册，会提示 `@某人 在本群没有配置群相册`。
- 配置的相册名在本群找不到时，会列出本群所有可用相册名，方便核对拼写。
- **引用的消息里有几张图就传几张**，逐张调用上传接口；部分失败会说明成功与失败张数。

> NapCat 的上传接口一次只收一张图，所以多张图会各自成为相册里的一次上传；批量上传（相册里显示为同一次）需要协议端支持，NapCat 目前没有。

## 实现说明

- 相册名 → `album_id`：调用 `get_qun_album_list` 拉取本群相册列表后按名字匹配，**不缓存**，每次命令都重新拉取。
- 上传：调用 `upload_image_to_qun_album`，四个参数 `group_id` / `album_id` / `album_name` / `file` 都是必填。
- `file` 优先用消息里图片的 URL，让 NapCat 自己下载；图片段没有 URL 时退回 `get_image` 取 NapCat 侧的本地路径。
- 接口调用走 `bot.internal._request`（`koishi-plugin-adapter-onebot` 把 `_request` 挂在 `bot.internal` 上，`session.onebot` 只是原始事件 payload），并自行判断 `retcode`。

## 开发

```bash
# 类型检查 + 声明文件
npx tsc -p external/sswm/tsconfig.json

# 构建 lib/index.js
node_modules/.bin/yakumo esbuild sswm

# 单元测试
cd external/sswm && ../../node_modules/.bin/tsx --test test/*.spec.ts
```
