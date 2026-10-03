import type { Context } from 'koishi';
import type { RuntimeContext } from '../runtime';
import { registerSswmCommand } from './sswm';
export declare function registerCommands(ctx: Context, runtime: RuntimeContext): void;
export { registerSswmCommand };
