import type { MediaSource } from './message';
import type { OneBotRequester } from './onebot';
export interface AlbumInfo {
    id: string;
    name: string;
}
export interface AlbumLookup {
    album?: AlbumInfo;
    albums: AlbumInfo[];
}
export declare function fetchAlbums(onebot: OneBotRequester, groupId: string): Promise<AlbumInfo[]>;
export declare function resolveAlbum(onebot: OneBotRequester, groupId: string, albumName: string): Promise<AlbumLookup>;
export declare function formatAlbumNames(albums: AlbumInfo[]): string;
export declare function isUnsupportedActionError(error: unknown): boolean;
export declare function uploadImageToAlbum(onebot: OneBotRequester, groupId: string, album: AlbumInfo, image: MediaSource): Promise<void>;
export declare function uploadImagesToAlbum(onebot: OneBotRequester, groupId: string, album: AlbumInfo, images: MediaSource[]): Promise<void>;
export declare function uploadVideoToAlbum(onebot: OneBotRequester, groupId: string, album: AlbumInfo, video: MediaSource): Promise<void>;
