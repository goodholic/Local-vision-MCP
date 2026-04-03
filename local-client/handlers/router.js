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
  const handler = handlers[command];
  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }
  return handler(params);
}
