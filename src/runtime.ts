import type { Config } from './config'

// 插件的运行时状态；目前只有配置，留这层是为了以后加状态方便。
export interface RuntimeContext {
  config: Config
}

export function createRuntime(config: Config): RuntimeContext {
  return { config }
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

// 本群已配置的映射，用于报错时提示。
export function describeBindings(config: Config, groupId: string) {
  const group = config.groups?.find(item => item.groupId === groupId)
  if (!group?.bindings?.length) {
    return '（无）'
  }
  return group.bindings.map(binding => `${binding.userId} → ${binding.album}`).join('、')
}
