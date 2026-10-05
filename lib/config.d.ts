import { Schema } from 'koishi';
export interface AlbumBinding {
    userId: string;
    album: string;
}
export interface GroupBindings {
    groupId: string;
    bindings: AlbumBinding[];
}
export interface Config {
    groups: GroupBindings[];
    silentWithoutImage: boolean;
    replyUploading: boolean;
    replyResult: boolean;
}
export declare const Config: Schema<Config>;
