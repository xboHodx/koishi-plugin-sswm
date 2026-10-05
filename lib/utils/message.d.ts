export interface MediaSource {
    src: string;
    file: string;
    kind: MediaKind;
}
export type MediaKind = 'image' | 'video';
export type ImageSource = MediaSource;
export declare function extractSingleAtId(input: string): string;
export declare function extractMediaSources(content: string): MediaSource[];
export declare function extractImageSources(content: string): ImageSource[];
