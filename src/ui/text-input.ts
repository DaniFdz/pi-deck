import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, Input, Key, matchesKey, truncateToWidth, type Focusable } from "@earendil-works/pi-tui";
import { PathPromptInput } from "./path-input.js";

export function isEnterInput(data: string): boolean {
  return data === "\r" || data === "\n" || data === "\x1bOM" || matchesKey(data, Key.enter);
}

export interface RequiredTextInputState {
  value: string;
  error?: string | undefined;
  submitted?: string | undefined;
  cancelled: boolean;
}

export interface RequiredTextInputModelOptions {
  initialValue: string;
  errorMessage: string;
  validate?: (value: string) => string | undefined | Promise<string | undefined>;
}

export function createRequiredTextInputModel(options: RequiredTextInputModelOptions) {
  const state: RequiredTextInputState = {
    value: options.initialValue,
    cancelled: false,
  };

  return {
    getState: () => ({ ...state }),
    async submit(value: string) {
      const trimmed = value.trim();
      state.value = value;
      state.submitted = undefined;
      if (!trimmed) {
        state.error = options.errorMessage;
        return;
      }
      const validationError = await options.validate?.(trimmed);
      if (validationError) {
        state.error = validationError;
        return;
      }
      state.error = undefined;
      state.submitted = trimmed;
    },
    cancel() {
      state.cancelled = true;
    },
  };
}

export async function askRequiredText(
  ctx: ExtensionCommandContext,
  options: {
    title: string;
    initialValue: string;
    errorMessage: string;
    validate?: (value: string) => string | undefined | Promise<string | undefined>;
  },
): Promise<string | undefined> {
  return ctx.ui.custom<string | undefined>((tui, theme, _keybindings, done) => {
    const input = new PathPromptInput();
    input.setPathValue(options.initialValue);
    const model = createRequiredTextInputModel(options);

    class RequiredTextPrompt extends Container implements Focusable {
      get focused(): boolean {
        return input.focused;
      }
      set focused(value: boolean) {
        input.focused = value;
      }

      constructor() {
        super();
        input.onEscape = () => {
          model.cancel();
          done(undefined);
        };
      }

      private submit(): void {
        void model.submit(input.getValue()).then(() => {
          const state = model.getState();
          if (state.submitted) done(state.submitted);
          else tui.requestRender();
        });
      }

      handleInput(data: string): void {
        if (isEnterInput(data)) {
          this.submit();
          return;
        }
        input.handleInput(data);
        tui.requestRender();
      }

      override render(width: number): string[] {
        const state = model.getState();
        const lines: string[] = [];
        lines.push(...new DynamicBorder((s: string) => theme.fg("accent", s)).render(width));
        lines.push(truncateToWidth(theme.fg("accent", theme.bold(options.title)), width));
        lines.push(...input.render(width));
        if (state.error) lines.push(truncateToWidth(theme.fg("error", state.error), width));
        lines.push(truncateToWidth(theme.fg("dim", "Enter accept • Esc cancel"), width));
        lines.push(...new DynamicBorder((s: string) => theme.fg("accent", s)).render(width));
        return lines;
      }

      override invalidate(): void {
        super.invalidate();
        input.invalidate();
      }
    }

    return new RequiredTextPrompt();
  });
}
