import screenshot from "screenshot-desktop";
import sharp from "sharp";

async function captureAndEncode(options = {}) {
  const { quality = 60, maxWidth = 1920, region } = options;

  // Capture full screen as PNG buffer
  const imgBuffer = await screenshot({ format: "png" });
  let pipeline = sharp(imgBuffer);

  // Crop if region specified
  if (region) {
    pipeline = pipeline.extract({
      left: region.x,
      top: region.y,
      width: region.width,
      height: region.height,
    });
  }

  // Get metadata for resize decision
  const metadata = await pipeline.metadata();
  const currentWidth = region ? region.width : metadata.width;

  if (currentWidth > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth });
  }

  const jpegBuffer = await pipeline.jpeg({ quality }).toBuffer();
  const finalMeta = await sharp(jpegBuffer).metadata();

  return {
    image: jpegBuffer.toString("base64"),
    width: finalMeta.width,
    height: finalMeta.height,
  };
}

export const screenHandlers = {
  async capture_screen(params) {
    return captureAndEncode({
      quality: params.quality || 60,
      maxWidth: params.maxWidth || 1920,
    });
  },

  async capture_region(params) {
    return captureAndEncode({
      quality: params.quality || 80,
      region: {
        x: params.x,
        y: params.y,
        width: params.width,
        height: params.height,
      },
    });
  },

  async capture_window(params) {
    // Capture full screen then we'd ideally crop to window bounds
    // For now, capture full screen - window-specific capture can be enhanced
    // with win32 APIs or xdotool on Linux
    const result = await captureAndEncode({
      quality: params.quality || 70,
    });
    result.windowTitle = params.titlePattern;
    return result;
  },

  async list_windows(params) {
    // Platform-specific window listing
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    try {
      // Windows: use PowerShell
      const { stdout } = await execAsync(
        'powershell -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne \'\'} | Select-Object ProcessName, MainWindowTitle, Id | ConvertTo-Json"',
        { encoding: "utf-8" }
      );
      const windows = JSON.parse(stdout);
      return { windows: Array.isArray(windows) ? windows : [windows] };
    } catch {
      return { windows: [] };
    }
  },

  async analyze_screen_layout(params) {
    return captureAndEncode({
      quality: 90,
      maxWidth: 2560,
      region: params.region,
    });
  },

  async find_ui_element(params) {
    // Basic implementation - capture screen and return info
    // Full OCR/template matching would need additional dependencies (Tesseract, OpenCV)
    // For now, return a "not implemented" that still functions
    return {
      found: false,
      message: "UI element search requires OCR setup. Use capture_screen + Claude vision instead.",
    };
  },
};
