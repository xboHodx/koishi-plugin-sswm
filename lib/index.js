var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Config: () => Config,
  apply: () => apply,
  name: () => name
});
module.exports = __toCommonJS(src_exports);

// src/commands/sswm.ts
var import_koishi2 = require("koishi");

// src/runtime.ts
function createAlbumCache(ttlSeconds) {
  const entries = /* @__PURE__ */ new Map();
  const ttl = ttlSeconds * 1e3;
  return {
    read(groupId) {
      const entry = entries.get(groupId);
      if (!entry) {
        return;
      }
      if (ttl > 0 && Date.now() - entry.stamp > ttl) {
        entries.delete(groupId);
        return;
      }
      return entry.albums;
    },
    write(groupId, albums) {
      entries.set(groupId, { albums, stamp: Date.now() });
    },
    invalidate(groupId) {
      entries.delete(groupId);
    }
  };
}
__name(createAlbumCache, "createAlbumCache");
function createRuntime(config) {
  return {
    config,
    albums: createAlbumCache(config.albumCacheTtl ?? 600)
  };
}
__name(createRuntime, "createRuntime");
function hasGroupConfig(config, groupId) {
  return !!config.groups?.some((item) => item.groupId === groupId);
}
__name(hasGroupConfig, "hasGroupConfig");
function findAlbumName(config, groupId, userId) {
  const group = config.groups?.find((item) => item.groupId === groupId);
  return group?.bindings?.find((binding) => binding.userId === userId)?.album;
}
__name(findAlbumName, "findAlbumName");

// src/utils/onebot.ts
function resolveOneBot(bot) {
  if (!bot || typeof bot !== "object") {
    return;
  }
  const direct = bot._request;
  if (typeof direct === "function") {
    return { _request: direct.bind(bot) };
  }
  const internal = bot.internal;
  const nested = internal?._request;
  if (typeof nested === "function") {
    return { _request: nested.bind(internal) };
  }
}
__name(resolveOneBot, "resolveOneBot");
function getSessionOneBot(session) {
  return resolveOneBot(session.bot);
}
__name(getSessionOneBot, "getSessionOneBot");
async function callOneBot(onebot, action, params) {
  const response = await onebot._request(action, params);
  if (!response || typeof response !== "object" || !("retcode" in response)) {
    return response;
  }
  const result = response;
  if (result.retcode !== 0) {
    throw new Error(result.message || result.wording || `retcode ${result.retcode}`);
  }
  return result.data;
}
__name(callOneBot, "callOneBot");

// src/utils/album.ts
var MAX_ALBUM_PAGES = 5;
function normalizeAlbums(data) {
  const list = data?.album_list;
  if (!Array.isArray(list)) {
    return [];
  }
  const albums = [];
  for (const item of list) {
    const id = item.album_id ?? item.id;
    const name2 = item.album_name ?? item.name;
    if (typeof id === "string" && typeof name2 === "string") {
      albums.push({ id, name: name2 });
    }
  }
  return albums;
}
__name(normalizeAlbums, "normalizeAlbums");
async function fetchAlbums(onebot, groupId) {
  const albums = [];
  let attachInfo = "";
  for (let page = 0; page < MAX_ALBUM_PAGES; page++) {
    const data = await callOneBot(onebot, "get_qun_album_list", {
      group_id: groupId,
      attach_info: attachInfo
    });
    albums.push(...normalizeAlbums(data));
    const next = data?.attach_info;
    if (data?.has_more !== true || typeof next !== "string" || !next || next === attachInfo) {
      break;
    }
    attachInfo = next;
  }
  return albums;
}
__name(fetchAlbums, "fetchAlbums");
async function resolveAlbum(onebot, groupId, albumName, cache) {
  let albums = cache.read(groupId);
  if (!albums) {
    albums = await fetchAlbums(onebot, groupId);
    cache.write(groupId, albums);
  }
  return { album: albums.find((item) => item.name === albumName), albums };
}
__name(resolveAlbum, "resolveAlbum");
function formatAlbumNames(albums) {
  if (albums.length === 0) {
    return "（本群还没有相册，请先在 QQ 客户端里创建）";
  }
  return albums.map((item) => `「${item.name}」`).join("、");
}
__name(formatAlbumNames, "formatAlbumNames");
async function resolveUploadSource(onebot, image) {
  if (/^(https?:|base64:|data:|file:)/i.test(image.src)) {
    return image.src;
  }
  if (image.file) {
    const data = await callOneBot(onebot, "get_image", { file: image.file });
    const localPath = data?.file ?? data?.path;
    if (typeof localPath === "string" && localPath) {
      return localPath;
    }
  }
  throw new Error(`无法获取图片地址（${image.src}）`);
}
__name(resolveUploadSource, "resolveUploadSource");
async function uploadImageToAlbum(onebot, groupId, album, image) {
  const file = await resolveUploadSource(onebot, image);
  await callOneBot(onebot, "upload_image_to_qun_album", {
    group_id: groupId,
    album_id: album.id,
    album_name: album.name,
    file
  });
}
__name(uploadImageToAlbum, "uploadImageToAlbum");

// src/utils/argv.ts
function ensureSession(argv) {
  if (!argv.session) {
    throw new Error("session is required for this command path");
  }
  return argv.session;
}
__name(ensureSession, "ensureSession");

// src/utils/message.ts
var import_koishi = require("koishi");
function extractSingleAtId(input) {
  const elements = import_koishi.h.parse(input);
  if (elements.length !== 1 || elements[0].type !== "at") {
    return;
  }
  const id = elements[0].attrs.id;
  if (typeof id !== "string") {
    return;
  }
  return id;
}
__name(extractSingleAtId, "extractSingleAtId");
function extractImageSources(content) {
  const images = [];
  for (const element of import_koishi.h.parse(content)) {
    if (element.type !== "img") {
      continue;
    }
    const src = element.attrs.src;
    const file = element.attrs.file;
    if (typeof src !== "string" || typeof file !== "string") {
      continue;
    }
    images.push({ src, file });
  }
  return images;
}
__name(extractImageSources, "extractImageSources");

// src/commands/sswm.ts
function registerSswmCommand(ctx, runtime) {
  const config = runtime.config;
  ctx.command("sswm [target:string]", "把引用的图片上传到群相册").usage("引用一条包含图片的消息，发送 sswm 即可上传到图片发送者的群相册\n加上 @某人 可以上传到对方的群相册").example("sswm").example("sswm @某人").action(async (argv, target) => {
    const session = ensureSession(argv);
    const groupId = session.guildId;
    if (groupId == null) {
      return "只能在群聊中使用";
    }
    if (!hasGroupConfig(config, groupId)) {
      return "本群还没有配置群相册映射，请先在插件配置里添加";
    }
    const quote = session.quote;
    if (quote == null) {
      return "你必须引用一条包含图片的消息";
    }
    const images = extractImageSources(quote.content ?? "");
    if (images.length === 0) {
      return "引用的消息里没有图片";
    }
    let userId = quote.user?.id;
    if (target) {
      const atId = extractSingleAtId(target);
      if (!atId) {
        return "请使用 @某人 的形式指定目标";
      }
      userId = atId;
    }
    if (!userId) {
      return "无法确定图片发送者，请用 @某人 指定";
    }
    const albumName = findAlbumName(config, groupId, userId);
    if (!albumName) {
      return (0, import_koishi2.h)("p", import_koishi2.h.at(userId), " 在本群没有配置群相册");
    }
    const onebot = getSessionOneBot(session);
    if (!onebot) {
      return "当前连接不支持调用 OneBot 相册接口，请检查适配器";
    }
    try {
      const lookup = await resolveAlbum(onebot, groupId, albumName, runtime.albums);
      const album = lookup.album;
      if (!album) {
        return `群相册「${albumName}」不存在，本群可用相册：${formatAlbumNames(lookup.albums)}`;
      }
      let success = 0;
      const failures = [];
      for (const image of images) {
        try {
          await uploadImageToAlbum(onebot, groupId, album, image);
          success += 1;
        } catch (error) {
          runtime.albums.invalidate(groupId);
          failures.push(error instanceof Error ? error.message : String(error));
        }
      }
      if (success === 0) {
        return `上传到群相册「${albumName}」失败：${failures[0] ?? "未知错误"}`;
      }
      if (failures.length > 0) {
        return (0, import_koishi2.h)("p", import_koishi2.h.at(userId), ` 的 ${success} 张图片已上传到群相册「${albumName}」，另有 ${failures.length} 张失败：${failures[0]}`);
      }
      return (0, import_koishi2.h)("p", import_koishi2.h.at(userId), ` 的 ${success} 张图片已上传到群相册「${albumName}」`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return `获取群相册列表失败：${reason}`;
    }
  });
}
__name(registerSswmCommand, "registerSswmCommand");

// src/commands/index.ts
function registerCommands(ctx, runtime) {
  registerSswmCommand(ctx, runtime);
}
__name(registerCommands, "registerCommands");

// src/config.ts
var import_koishi3 = require("koishi");
var Config = import_koishi3.Schema.object({
  groups: import_koishi3.Schema.array(import_koishi3.Schema.object({
    groupId: import_koishi3.Schema.string().required().description("群号"),
    bindings: import_koishi3.Schema.array(import_koishi3.Schema.object({
      userId: import_koishi3.Schema.string().required().description("QQ 号"),
      album: import_koishi3.Schema.string().required().description("群相册名")
    })).role("table").description("QQ 号 → 群相册名")
  })).role("table").description("每个群一组「QQ 号 → 群相册名」映射"),
  albumCacheTtl: import_koishi3.Schema.natural().default(600).description("群相册列表缓存时间（秒），0 表示每次都重新获取")
});

// src/index.ts
var name = "sswm";
function apply(ctx, cfg) {
  const runtime = createRuntime(cfg);
  registerCommands(ctx, runtime);
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  name
});
