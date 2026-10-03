import type { ImageSource } from './message';
import type { OneBotRequester } from './onebot';
export interface AlbumInfo {
    id: string;
    name: string;
}
export interface AlbumCache {
    read(groupId: string): AlbumInfo[] | undefined;
    write(groupId: string, albums: AlbumInfo[]): void;
    invalidate(groupId: string): void;
}
export interface AlbumLookup {
    album?: AlbumInfo;
    albums: AlbumInfo[];
}
export declare function fetchAlbums(onebot: OneBotRequester, groupId: string): Promise<AlbumInfo[]>;
export declare function resolveAlbum(onebot: OneBotRequester, groupId: string, albumName: string, cache: AlbumCache): Promise<AlbumLookup>;
export declare function formatAlbumNames(albums: AlbumInfo[]): string;
export declare function uploadImageToAlbum(onebot: OneBotRequester, groupId: string, album: AlbumInfo, image: ImageSource): Promise<void>;
