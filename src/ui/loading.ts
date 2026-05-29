import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

type LoadingResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

export async function withLoading<T>(ctx: ExtensionCommandContext, message: string, task: () => Promise<T>): Promise<T> {
  const result = await ctx.ui.custom<LoadingResult<T>>((_tui, theme, _keybindings, done) => {
    void task().then(
      (value) => done({ ok: true, value }),
      (error) => done({ ok: false, error }),
    );
    return new Text(theme.fg("accent", message), 1, 1);
  }, { overlay: true });

  if (!result.ok) throw result.error;
  return result.value;
}
