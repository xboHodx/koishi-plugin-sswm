import type { Config } from './config';
import type { AlbumCache } from './utils/album';
export interface RuntimeContext {
    config: Config;
    albums: AlbumCache;
}
export declare function createRuntime(config: Config): RuntimeContext;
export declare function hasGroupConfig(config: Config, groupId: string): boolean;
export declare function findAlbumName(config: Config, groupId: string, userId: string): string;
