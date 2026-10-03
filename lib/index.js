var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
function createRuntime(config) {
  return {
    config,
    albums: createAlbumCache(config.albumCacheTtl ?? 600)
  };
}
function hasGroupConfig(config, groupId) {
  return !!config.groups?.some((item) => item.groupId === groupId);
}
function findAlbumName(config, groupId, userId) {
  const group = config.groups?.find((item) => item.groupId === groupId);
  return group?.bindings?.find((binding) => binding.userId === userId)?.album;
}

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
function getSessionOneBot(session) {
  return resolveOneBot(session.bot);
}
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
async function resolveAlbum(onebot, groupId, albumName, cache) {
  let albums = cache.read(groupId);
  if (!albums) {
    albums = await fetchAlbums(onebot, groupId);
    cache.write(groupId, albums);
  }
  return { album: albums.find((item) => item.name === albumName), albums };
}
function formatAlbumNames(albums) {
  if (albums.length === 0) {
    return "\uFF08\u672C\u7FA4\u8FD8\u6CA1\u6709\u76F8\u518C\uFF0C\u8BF7\u5148\u5728 QQ \u5BA2\u6237\u7AEF\u91CC\u521B\u5EFA\uFF09";
  }
  return albums.map((item) => `\u300C${item.name}\u300D`).join("\u3001");
}
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
  throw new Error(`\u65E0\u6CD5\u83B7\u53D6\u56FE\u7247\u5730\u5740\uFF08${image.src}\uFF09`);
}
async function uploadImageToAlbum(onebot, groupId, album, image) {
  const file = await resolveUploadSource(onebot, image);
  await callOneBot(onebot, "upload_image_to_qun_album", {
    group_id: groupId,
    album_id: album.id,
    album_name: album.name,
    file
  });
}

// src/utils/argv.ts
function ensureSession(argv) {
  if (!argv.session) {
    throw new Error("session is required for this command path");
  }
  return argv.session;
}

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

// src/commands/sswm.ts
function registerSswmCommand(ctx, runtime) {
  const config = runtime.config;
  ctx.command("sswm [target:string]", "\u628A\u5F15\u7528\u7684\u56FE\u7247\u4E0A\u4F20\u5230\u7FA4\u76F8\u518C").usage("\u5F15\u7528\u4E00\u6761\u5305\u542B\u56FE\u7247\u7684\u6D88\u606F\uFF0C\u53D1\u9001 sswm \u5373\u53EF\u4E0A\u4F20\u5230\u56FE\u7247\u53D1\u9001\u8005\u7684\u7FA4\u76F8\u518C\n\u52A0\u4E0A @\u67D0\u4EBA \u53EF\u4EE5\u4E0A\u4F20\u5230\u5BF9\u65B9\u7684\u7FA4\u76F8\u518C").example("sswm").example("sswm @\u67D0\u4EBA").action(async (argv, target) => {
    const session = ensureSession(argv);
    const groupId = session.guildId;
    if (groupId == null) {
      return "\u53EA\u80FD\u5728\u7FA4\u804A\u4E2D\u4F7F\u7528";
    }
    if (!hasGroupConfig(config, groupId)) {
      return "\u672C\u7FA4\u8FD8\u6CA1\u6709\u914D\u7F6E\u7FA4\u76F8\u518C\u6620\u5C04\uFF0C\u8BF7\u5148\u5728\u63D2\u4EF6\u914D\u7F6E\u91CC\u6DFB\u52A0";
    }
    const quote = session.quote;
    if (quote == null) {
      return "\u4F60\u5FC5\u987B\u5F15\u7528\u4E00\u6761\u5305\u542B\u56FE\u7247\u7684\u6D88\u606F";
    }
    const images = extractImageSources(quote.content ?? "");
    if (images.length === 0) {
      return "\u5F15\u7528\u7684\u6D88\u606F\u91CC\u6CA1\u6709\u56FE\u7247";
    }
    let userId = quote.user?.id;
    if (target) {
      const atId = extractSingleAtId(target);
      if (!atId) {
        return "\u8BF7\u4F7F\u7528 @\u67D0\u4EBA \u7684\u5F62\u5F0F\u6307\u5B9A\u76EE\u6807";
      }
      userId = atId;
    }
    if (!userId) {
      return "\u65E0\u6CD5\u786E\u5B9A\u56FE\u7247\u53D1\u9001\u8005\uFF0C\u8BF7\u7528 @\u67D0\u4EBA \u6307\u5B9A";
    }
    const albumName = findAlbumName(config, groupId, userId);
    if (!albumName) {
      return (0, import_koishi2.h)("p", import_koishi2.h.at(userId), " \u5728\u672C\u7FA4\u6CA1\u6709\u914D\u7F6E\u7FA4\u76F8\u518C");
    }
    const onebot = getSessionOneBot(session);
    if (!onebot) {
      return "\u5F53\u524D\u8FDE\u63A5\u4E0D\u652F\u6301\u8C03\u7528 OneBot \u76F8\u518C\u63A5\u53E3\uFF0C\u8BF7\u68C0\u67E5\u9002\u914D\u5668";
    }
    try {
      const lookup = await resolveAlbum(onebot, groupId, albumName, runtime.albums);
      const album = lookup.album;
      if (!album) {
        return `\u7FA4\u76F8\u518C\u300C${albumName}\u300D\u4E0D\u5B58\u5728\uFF0C\u672C\u7FA4\u53EF\u7528\u76F8\u518C\uFF1A${formatAlbumNames(lookup.albums)}`;
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
        return `\u4E0A\u4F20\u5230\u7FA4\u76F8\u518C\u300C${albumName}\u300D\u5931\u8D25\uFF1A${failures[0] ?? "\u672A\u77E5\u9519\u8BEF"}`;
      }
      if (failures.length > 0) {
        return (0, import_koishi2.h)("p", import_koishi2.h.at(userId), ` \u7684 ${success} \u5F20\u56FE\u7247\u5DF2\u4E0A\u4F20\u5230\u7FA4\u76F8\u518C\u300C${albumName}\u300D\uFF0C\u53E6\u6709 ${failures.length} \u5F20\u5931\u8D25\uFF1A${failures[0]}`);
      }
      return (0, import_koishi2.h)("p", import_koishi2.h.at(userId), ` \u7684 ${success} \u5F20\u56FE\u7247\u5DF2\u4E0A\u4F20\u5230\u7FA4\u76F8\u518C\u300C${albumName}\u300D`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return `\u83B7\u53D6\u7FA4\u76F8\u518C\u5217\u8868\u5931\u8D25\uFF1A${reason}`;
    }
  });
}

// src/commands/index.ts
function registerCommands(ctx, runtime) {
  registerSswmCommand(ctx, runtime);
}

// src/config.ts
var import_koishi3 = require("koishi");
var Config = import_koishi3.Schema.object({
  groups: import_koishi3.Schema.array(import_koishi3.Schema.object({
    groupId: import_koishi3.Schema.string().required().description("\u7FA4\u53F7"),
    bindings: import_koishi3.Schema.array(import_koishi3.Schema.object({
      userId: import_koishi3.Schema.string().required().description("QQ \u53F7"),
      album: import_koishi3.Schema.string().required().description("\u7FA4\u76F8\u518C\u540D")
    })).role("table").description("QQ \u53F7 \u2192 \u7FA4\u76F8\u518C\u540D")
  })).role("table").description("\u6BCF\u4E2A\u7FA4\u4E00\u7EC4\u300CQQ \u53F7 \u2192 \u7FA4\u76F8\u518C\u540D\u300D\u6620\u5C04"),
  albumCacheTtl: import_koishi3.Schema.natural().default(600).description("\u7FA4\u76F8\u518C\u5217\u8868\u7F13\u5B58\u65F6\u95F4\uFF08\u79D2\uFF09\uFF0C0 \u8868\u793A\u6BCF\u6B21\u90FD\u91CD\u65B0\u83B7\u53D6")
});

// src/index.ts
var name = "sswm";
function apply(ctx, cfg) {
  const runtime = createRuntime(cfg);
  registerCommands(ctx, runtime);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  name
});
