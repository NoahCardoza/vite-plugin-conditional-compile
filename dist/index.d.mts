import { FilterPattern, Plugin } from 'vite';

interface Options {
    /**
     * @default ["**\/*"]
     */
    include: FilterPattern;
    /**
     * @default []
     */
    exclude: FilterPattern;
}
type UserOptions = Partial<Options>;

declare const VitePluginConditionalCompile: (userOptions?: UserOptions) => Plugin;

export { VitePluginConditionalCompile as default };
