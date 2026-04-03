import { screenHandlers } from "./screen.js";
import { mouseHandlers } from "./mouse.js";
import { keyboardHandlers } from "./keyboard.js";
import { unityHandlers } from "./unity.js";
import { sdHandlers } from "./stable-diffusion.js";
import { fileHandlers } from "./file.js";
import { systemHandlers } from "./system.js";

const handlers = {
  ...screenHandlers,
  ...mouseHandlers,
  ...keyboardHandlers,
  ...unityHandlers,
  ...sdHandlers,
  ...fileHandlers,
  ...systemHandlers,
};

export async function handleCommand(command, params) {
  // ── Batch: execute multiple actions in one round-trip ──
  if (command === "batch_execute") {
    const actions = params.actions || [];
    const results = [];
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      try {
        // Built-in wait between actions
        if (action.waitBefore) {
          await new Promise((r) => setTimeout(r, Number(action.waitBefore)));
        }
        const handler = handlers[action.command];
        if (!handler) throw new Error(`Unknown command: ${action.command}`);
        const result = await handler(action.params || {});
        results.push({ index: i, command: action.command, success: true, result });
      } catch (err) {
        results.push({ index: i, command: action.command, success: false, error: err.message });
        if (params.stopOnError) break;
      }
    }
    return { results };
  }

  const handler = handlers[command];
  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }
  return handler(params);
}
