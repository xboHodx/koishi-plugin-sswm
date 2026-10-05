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
}
export declare const Config: Schema<Config>;
