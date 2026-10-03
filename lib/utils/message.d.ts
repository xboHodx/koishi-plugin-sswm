export interface ImageSource {
    src: string;
    file: string;
}
export declare function extractSingleAtId(input: string): string;
export declare function extractImageSources(content: string): ImageSource[];
