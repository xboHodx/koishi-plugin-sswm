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
function createRuntime(config) {
  return { config };
}
function hasGroupConfig(config, groupId) {
  return !!config.groups?.some((item) => item.groupId === groupId);
}
function findAlbumName(config, groupId, userId) {
  const group = config.groups?.find((item) => item.groupId === groupId);
  return group?.bindings?.find((binding) => binding.userId === userId)?.album;
}
function describeBindings(config, groupId) {
  const group = config.groups?.find((item) => item.groupId === groupId);
  if (!group?.bindings?.length) {
    return "\uFF08\u65E0\uFF09";
  }
  return group.bindings.map((binding) => `${binding.userId} \u2192 ${binding.album}`).join("\u3001");
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
async function resolveAlbum(onebot, groupId, albumName) {
  const albums = await fetchAlbums(onebot, groupId);
  return { album: albums.find((item) => item.name === albumName), albums };
}
function formatAlbumNames(albums) {
  if (albums.length === 0) {
    return "\uFF08\u672C\u7FA4\u8FD8\u6CA1\u6709\u76F8\u518C\uFF0C\u8BF7\u5148\u5728 QQ \u5BA2\u6237\u7AEF\u91CC\u521B\u5EFA\uFF09";
  }
  return albums.map((item) => `\u300C${item.name}\u300D`).join("\u3001");
}
function isUnsupportedActionError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /不支持的\s*Api|unsupported\s*action|action\s+.*not\s+found/i.test(message);
}
async function resolveUploadSource(onebot, media) {
  if (/^(https?:|base64:|data:|file:)/i.test(media.src)) {
    return media.src;
  }
  if (media.kind === "image" && media.file) {
    const data = await callOneBot(onebot, "get_image", { file: media.file });
    const localPath = data?.file ?? data?.path;
    if (typeof localPath === "string" && localPath) {
      return localPath;
    }
  }
  const label = media.kind === "video" ? "\u89C6\u9891" : "\u56FE\u7247";
  throw new Error(`\u65E0\u6CD5\u83B7\u53D6${label}\u5730\u5740\uFF08${media.src}\uFF09`);
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
async function uploadImagesToAlbum(onebot, groupId, album, images) {
  const files = [];
  for (const image of images) {
    files.push(await resolveUploadSource(onebot, image));
  }
  await callOneBot(onebot, "upload_images_to_qun_album", {
    group_id: groupId,
    album_id: album.id,
    album_name: album.name,
    files
  });
}
async function uploadVideoToAlbum(onebot, groupId, album, video) {
  const file = await resolveUploadSource(onebot, video);
  await callOneBot(onebot, "upload_video_to_qun_album", {
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
function extractMediaSources(content) {
  const media = [];
  for (const element of import_koishi.h.parse(content)) {
    const kind = element.type === "img" ? "image" : element.type === "video" ? "video" : void 0;
    if (!kind) {
      continue;
    }
    const src = element.attrs.src;
    const file = element.attrs.file;
    if (typeof src === "string" && src) {
      media.push({ src, file: typeof file === "string" ? file : "", kind });
    } else if (typeof file === "string" && file) {
      media.push({ src: file, file, kind });
    }
  }
  return media;
}

// src/commands/sswm.ts
async function uploadImages(onebot, groupId, album, images, onProgress) {
  const failures = [];
  if (images.length === 1) {
    const started2 = Date.now();
    try {
      await uploadImageToAlbum(onebot, groupId, album, images[0]);
      onProgress(1, Date.now() - started2);
      return { ok: 1, failures };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      onProgress(1, Date.now() - started2, reason);
      return { ok: 0, failures: [reason] };
    }
  }
  const started = Date.now();
  try {
    await uploadImagesToAlbum(onebot, groupId, album, images);
    onProgress(images.length, Date.now() - started);
    return { ok: images.length, failures };
  } catch (error) {
    if (!isUnsupportedActionError(error)) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(reason);
      return { ok: 0, failures };
    }
    onProgress(0, Date.now() - started, "\u534F\u8BAE\u7AEF\u4E0D\u652F\u6301\u6279\u91CF\u4E0A\u4F20\uFF0C\u6539\u4E3A\u9010\u5F20\u4E0A\u4F20");
  }
  let ok = 0;
  for (const [index, image] of images.entries()) {
    const each = Date.now();
    try {
      await uploadImageToAlbum(onebot, groupId, album, image);
      ok += 1;
      onProgress(index + 1, Date.now() - each);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(reason);
      onProgress(index + 1, Date.now() - each, reason);
    }
  }
  return { ok, failures };
}
function registerSswmCommand(ctx, runtime) {
  const config = runtime.config;
  const logger = ctx.logger("sswm");
  ctx.command("sswm [target:string]", "\u628A\u5F15\u7528\u7684\u56FE\u7247\u6216\u89C6\u9891\u4E0A\u4F20\u5230\u7FA4\u76F8\u518C").usage("\u5F15\u7528\u4E00\u6761\u5305\u542B\u56FE\u7247/\u89C6\u9891\u7684\u6D88\u606F\uFF0C\u53D1\u9001 sswm \u5373\u53EF\u4E0A\u4F20\u5230\u53D1\u9001\u8005\u7684\u7FA4\u76F8\u518C\n\u52A0\u4E0A @\u67D0\u4EBA \u53EF\u4EE5\u4E0A\u4F20\u5230\u5BF9\u65B9\u7684\u7FA4\u76F8\u518C\n\u540C\u4E00\u6279\u7684\u591A\u5F20\u56FE\u7247\u4F1A\u5408\u5E76\u6210\u76F8\u518C\u91CC\u7684\u4E00\u6761").example("sswm").example("sswm @\u67D0\u4EBA").action(async (argv, target) => {
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
      return config.silentWithoutImage ? void 0 : "\u4F60\u5FC5\u987B\u5F15\u7528\u4E00\u6761\u5305\u542B\u56FE\u7247\u6216\u89C6\u9891\u7684\u6D88\u606F";
    }
    const media = extractMediaSources(quote.content ?? "");
    if (media.length === 0) {
      return config.silentWithoutImage ? void 0 : "\u5F15\u7528\u7684\u6D88\u606F\u91CC\u6CA1\u6709\u56FE\u7247\u6216\u89C6\u9891";
    }
    const images = media.filter((item) => item.kind === "image");
    const videos = media.filter((item) => item.kind === "video");
    const atId = target ? extractSingleAtId(target) : void 0;
    const userId = atId ?? quote.user?.id;
    if (!userId) {
      return "\u88AB\u5F15\u7528\u7684\u6D88\u606F\u91CC\u6CA1\u6709\u53D1\u9001\u8005\u4FE1\u606F\uFF0C\u8BF7\u7528 @\u67D0\u4EBA \u6307\u5B9A";
    }
    const albumName = findAlbumName(config, groupId, userId);
    if (!albumName) {
      return (0, import_koishi2.h)("p", import_koishi2.h.at(userId), ` \u5728\u672C\u7FA4\u8FD8\u6CA1\u6709\u914D\u7F6E\u7FA4\u76F8\u518C\uFF08\u672C\u7FA4\u5DF2\u914D\u7F6E\uFF1A${describeBindings(config, groupId)}\uFF09`);
    }
    const onebot = getSessionOneBot(session);
    if (!onebot) {
      return "\u5F53\u524D\u8FDE\u63A5\u4E0D\u652F\u6301\u8C03\u7528 OneBot \u76F8\u518C\u63A5\u53E3\uFF0C\u8BF7\u68C0\u67E5\u9002\u914D\u5668";
    }
    let album;
    try {
      const lookup = await resolveAlbum(onebot, groupId, albumName);
      album = lookup.album;
      if (!album) {
        return `\u7FA4\u76F8\u518C\u300C${albumName}\u300D\u4E0D\u5B58\u5728\uFF0C\u672C\u7FA4\u53EF\u7528\u76F8\u518C\uFF1A${formatAlbumNames(lookup.albums)}`;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return `\u83B7\u53D6\u7FA4\u76F8\u518C\u5217\u8868\u5931\u8D25\uFF1A${reason}`;
    }
    const describe = [
      images.length ? `${images.length} \u5F20\u56FE\u7247` : "",
      videos.length ? `${videos.length} \u4E2A\u89C6\u9891` : ""
    ].filter(Boolean).join(" \u548C ");
    const batchStarted = Date.now();
    logger.info(`\u5F00\u59CB\u4E0A\u4F20 ${describe} \u5230\u7FA4\u76F8\u518C\u300C${albumName}\u300D\uFF08${album.id}\uFF09`);
    void (async () => {
      const result = { images: 0, videos: 0, failures: [] };
      const logProgress = (label) => (index, ms, error) => {
        if (error) {
          logger.warn(`${label} ${index} \u5931\u8D25\uFF08${ms}ms\uFF09\uFF1A${error}`);
        } else {
          logger.info(`${label} ${index} \u6210\u529F\uFF08${ms}ms\uFF09`);
        }
      };
      if (images.length) {
        const outcome = await uploadImages(onebot, groupId, album, images, logProgress("\u56FE\u7247"));
        result.images = outcome.ok;
        result.failures.push(...outcome.failures);
      }
      for (const [index, video] of videos.entries()) {
        const started = Date.now();
        try {
          await uploadVideoToAlbum(onebot, groupId, album, video);
          result.videos += 1;
          logProgress("\u89C6\u9891")(index + 1, Date.now() - started);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          result.failures.push(reason);
          logProgress("\u89C6\u9891")(index + 1, Date.now() - started, reason);
        }
      }
      logger.info(`\u672C\u6279\u5B8C\u6210\uFF1A\u56FE\u7247 ${result.images}/${images.length}\uFF0C\u89C6\u9891 ${result.videos}/${videos.length}\uFF0C\u603B\u7528\u65F6 ${Date.now() - batchStarted}ms`);
      const done = [
        result.images ? `${result.images} \u5F20\u56FE\u7247` : "",
        result.videos ? `${result.videos} \u4E2A\u89C6\u9891` : ""
      ].filter(Boolean).join(" \u548C ");
      try {
        if (!done) {
          await session.send(`\u4E0A\u4F20\u5230\u7FA4\u76F8\u518C\u300C${albumName}\u300D\u5931\u8D25\uFF1A${result.failures[0] ?? "\u672A\u77E5\u9519\u8BEF"}`);
        } else if (result.failures.length > 0) {
          const rest = config.replyResult ? `\uFF08\u5176\u4F59 ${done}\u5DF2\u4E0A\u4F20\uFF09` : "";
          await session.send((0, import_koishi2.h)("p", import_koishi2.h.at(userId), ` \u4E0A\u4F20\u5230\u7FA4\u76F8\u518C\u300C${albumName}\u300D\u65F6\u6709 ${result.failures.length} \u9879\u5931\u8D25\uFF1A${result.failures[0]}${rest}`));
        } else if (config.replyResult) {
          await session.send((0, import_koishi2.h)("p", import_koishi2.h.at(userId), ` \u7684 ${done}\u5DF2\u4E0A\u4F20\u5230\u7FA4\u76F8\u518C\u300C${albumName}\u300D`));
        }
      } catch (error) {
        logger.warn(`\u56DE\u4F20\u4E0A\u4F20\u7ED3\u679C\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
      }
    })();
    return config.replyUploading ? `\u6B63\u5728\u4E0A\u4F20 ${describe} \u5230\u7FA4\u76F8\u518C\u300C${albumName}\u300D\u2026` : void 0;
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
  silentWithoutImage: import_koishi3.Schema.boolean().default(false).description("\u6CA1\u6709\u5F15\u7528\u53EF\u4E0A\u4F20\u7684\u5A92\u4F53\uFF08\u56FE\u7247/\u89C6\u9891\uFF09\u65F6\u9759\u9ED8\u5931\u8D25\uFF08\u4E0D\u56DE\u590D\u4EFB\u4F55\u63D0\u793A\uFF09"),
  replyUploading: import_koishi3.Schema.boolean().default(true).description("\u56DE\u6267\u300C\u6B63\u5728\u4E0A\u4F20 N \u5F20\u56FE\u7247\u2026\u300D\uFF08\u5173\u6389\u540E\u547D\u4EE4\u4E0D\u56DE\u590D\uFF0C\u4E0A\u4F20\u7167\u5E38\u8FDB\u884C\uFF09"),
  replyResult: import_koishi3.Schema.boolean().default(true).description("\u4E0A\u4F20\u6210\u529F\u65F6\u56DE\u62A5\u7ED3\u679C\uFF08\u5173\u6389\u540E\u6210\u529F\u4E0D\u56DE\u590D\uFF1B\u5931\u8D25\u4E00\u5F8B\u4F1A\u5728\u7FA4\u91CC\u8BF4\uFF09")
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
