import type { Session } from 'koishi';
export interface OneBotRequester {
    _request(action: string, params: Record<string, unknown>): Promise<unknown>;
}
export declare function resolveOneBot(bot: unknown): OneBotRequester | undefined;
export declare function getSessionOneBot(session: Session): OneBotRequester | undefined;
export declare function callOneBot(onebot: OneBotRequester, action: string, params: Record<string, unknown>): Promise<unknown>;
