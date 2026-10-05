import type { Config } from './config';
export interface RuntimeContext {
    config: Config;
}
export declare function createRuntime(config: Config): RuntimeContext;
export declare function hasGroupConfig(config: Config, groupId: string): boolean;
export declare function findAlbumName(config: Config, groupId: string, userId: string): string;
export declare function describeBindings(config: Config, groupId: string): string;
