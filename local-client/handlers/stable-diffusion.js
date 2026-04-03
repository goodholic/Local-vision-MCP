import { keyboard, Key, mouse, straightTo, Point } from "@nut-tree-fork/nut-js";
import { screenHandlers } from "./screen.js";

/**
 * Stable Diffusion WebUI interaction handlers.
 *
 * Strategy: Rather than hardcoding UI coordinates, these handlers provide
 * building blocks. Claude captures the screen, identifies the UI elements
 * visually, then uses mouse_click/keyboard_type to interact.
 *
 * For the API approach (more reliable), SD WebUI exposes an API at /sdapi/v1.
 * We try the API first, fall back to UI automation.
 */

const SD_API_URL = process.env.SD_API_URL || "http://127.0.0.1:7860";

export const sdHandlers = {
  async sd_generate_image(params) {
    // Try API approach first
    try {
      const response = await fetch(`${SD_API_URL}/sdapi/v1/txt2img`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: params.prompt,
          negative_prompt: params.negativePrompt || "",
          width: params.width || 512,
          height: params.height || 512,
          steps: params.steps || 20,
          seed: params.seed ?? -1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.images && data.images.length > 0) {
          return {
            image: data.images[0],
            message: `API로 이미지 생성 완료. Seed: ${data.parameters?.seed || "unknown"}`,
          };
        }
      }
    } catch {
      // API not available, fall back to UI
    }

    // Fallback: tell Claude to use UI automation
    return {
      message: `SD API를 사용할 수 없습니다. 화면에서 직접 조작해 주세요.\n프롬프트: ${params.prompt}`,
    };
  },

  async sd_capture_output(params) {
    // Capture the screen showing SD WebUI output
    return screenHandlers.capture_screen({ quality: 85 });
  },
};
