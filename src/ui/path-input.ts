import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, Input, Key, Text, matchesKey, truncateToWidth, type Focusable } from "@earendil-works/pi-tui";
import type { DirectoryCompletion, DirectoryValidation } from "../services/paths.js";

export interface PathInputState {
  value: string;
  error?: string | undefined;
  suggestions: string[];
  submitted?: string | undefined;
  cancelled: boolean;
}

export interface PathInputModelOptions {
  initialValue: string;
  validate: (value: string) => Promise<DirectoryValidation>;
  complete: (value: string) => Promise<DirectoryCompletion>;
}

export class PathPromptInput extends Input {
  setPathValue(value: string): void {
    this.setValue(value);
    this.handleInput("\x1b[F");
  }
}

export function createPathInputModel(options: PathInputModelOptions) {
  const state: PathInputState = {
    value: options.initialValue,
    suggestions: [],
    cancelled: false,
  };

  return {
    getState: () => ({ ...state, suggestions: [...state.suggestions] }),
    setValue(value: string) {
      state.value = value;
      state.error = undefined;
      state.suggestions = [];
    },
    async submit() {
      const result = await options.validate(state.value);
      if (!result.ok) {
        state.error = result.error;
        state.submitted = undefined;
        return;
      }
      state.error = undefined;
      state.submitted = result.path;
    },
    async completePath() {
      const result = await options.complete(state.value);
      state.error = undefined;
      state.suggestions = result.suggestions;
      if (result.completed) state.value = result.completed;
    },
    cancel() {
      state.cancelled = true;
    },
  };
}

export async function askPath(
  ctx: ExtensionCommandContext,
  options: {
    title: string;
    initialValue: string;
    validate: (value: string) => Promise<DirectoryValidation>;
    complete: (value: string) => Promise<DirectoryCompletion>;
  },
): Promise<string | undefined> {
  return ctx.ui.custom<string | undefined>((tui, theme, _keybindings, done) => {
    const input = new PathPromptInput();
    input.setPathValue(options.initialValue);
    const model = createPathInputModel({
      initialValue: options.initialValue,
      validate: options.validate,
      complete: options.complete,
    });

    class PathPrompt extends Container implements Focusable {
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
        input.onSubmit = () => {
          model.setValue(input.getValue());
          void model.submit().then(() => {
            const state = model.getState();
            if (state.submitted) done(state.submitted);
            else tui.requestRender();
          });
        };
      }

      handleInput(data: string): void {
        if (matchesKey(data, Key.tab)) {
          model.setValue(input.getValue());
          void model.completePath().then(() => {
            input.setPathValue(model.getState().value);
            tui.requestRender();
          });
          return;
        }
        input.handleInput(data);
        model.setValue(input.getValue());
        tui.requestRender();
      }

      override render(width: number): string[] {
        const state = model.getState();
        const lines: string[] = [];
        lines.push(...new DynamicBorder((s: string) => theme.fg("accent", s)).render(width));
        lines.push(truncateToWidth(theme.fg("accent", theme.bold(options.title)), width));
        lines.push(...input.render(width));
        if (state.error) lines.push(truncateToWidth(theme.fg("error", state.error), width));
        for (const suggestion of state.suggestions.slice(0, 6)) {
          lines.push(truncateToWidth(theme.fg("dim", `  ${suggestion}`), width));
        }
        lines.push(truncateToWidth(theme.fg("dim", "Tab complete • Enter accept • Esc cancel"), width));
        lines.push(...new DynamicBorder((s: string) => theme.fg("accent", s)).render(width));
        return lines;
      }

      override invalidate(): void {
        super.invalidate();
        input.invalidate();
      }
    }

    return new PathPrompt();
  });
}
