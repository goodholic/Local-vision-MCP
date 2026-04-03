import { keyboard, Key, mouse, straightTo, Point } from "@nut-tree-fork/nut-js";
import { screenHandlers } from "./screen.js";

/**
 * Unity-specific handlers.
 * These capture specific Unity Editor panels by using known layout positions.
 * In practice, the positions may need calibration per user's Unity layout.
 *
 * A more robust approach: Claude captures full screen first, identifies panel
 * locations visually, then uses capture_region for specific panels.
 */

export const unityHandlers = {
  async unity_capture_console(params) {
    // Capture full screen - Claude will identify the Console panel visually
    const result = await screenHandlers.capture_screen({ quality: 75 });

    // Try to read console text via clipboard (Ctrl+A, Ctrl+C in console)
    // This is a best-effort approach
    let consoleText = "";
    try {
      // We could focus the console and copy, but that's invasive
      // Better to let Claude read the screenshot
      consoleText = "콘솔 내용은 스크린샷을 통해 확인하세요.";
    } catch (e) {
      consoleText = "";
    }

    return {
      image: result.image,
      width: result.width,
      height: result.height,
      consoleText,
    };
  },

  async unity_capture_hierarchy(params) {
    return screenHandlers.capture_screen({ quality: 75 });
  },

  async unity_capture_inspector(params) {
    return screenHandlers.capture_screen({ quality: 75 });
  },

  async unity_capture_scene(params) {
    return screenHandlers.capture_screen({ quality: 75 });
  },

  async unity_capture_project(params) {
    return screenHandlers.capture_screen({ quality: 75 });
  },

  async unity_play_stop(params) {
    // Unity shortcuts: Ctrl+P = Play/Stop, Ctrl+Shift+P = Pause
    switch (params.action) {
      case "play":
      case "stop":
        await keyboard.pressKey(Key.LeftControl, Key.P);
        await keyboard.releaseKey(Key.P, Key.LeftControl);
        break;
      case "pause":
        await keyboard.pressKey(Key.LeftControl, Key.LeftShift, Key.P);
        await keyboard.releaseKey(Key.P, Key.LeftShift, Key.LeftControl);
        break;
    }
    // Wait for Unity to respond
    await new Promise((r) => setTimeout(r, 500));
    return {};
  },
};
