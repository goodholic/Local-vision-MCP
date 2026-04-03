import { mouse } from "@nut-tree-fork/nut-js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const systemHandlers = {
  async get_screen_info(params) {
    try {
      const { stdout } = await execAsync(
        'powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens | ForEach-Object { @{ DeviceName=$_.DeviceName; Bounds=@{X=$_.Bounds.X;Y=$_.Bounds.Y;Width=$_.Bounds.Width;Height=$_.Bounds.Height}; Primary=$_.Primary; BitsPerPixel=$_.BitsPerPixel } } | ConvertTo-Json"',
        { encoding: "utf-8" }
      );
      const screens = JSON.parse(stdout);
      return { screens: Array.isArray(screens) ? screens : [screens] };
    } catch (err) {
      return { error: err.message };
    }
  },

  async get_mouse_position(params) {
    const pos = await mouse.getPosition();
    return { x: pos.x, y: pos.y };
  },

  async get_active_window(params) {
    try {
      const { stdout } = await execAsync(
        'powershell -Command "Add-Type -AssemblyName Microsoft.VisualBasic; $p = Get-Process | Where-Object {$_.MainWindowHandle -eq [Microsoft.VisualBasic.Interaction]::AppActivate($_.Id) } | Select-Object -First 1; @{Title=$p.MainWindowTitle;Process=$p.ProcessName;Id=$p.Id} | ConvertTo-Json"',
        { encoding: "utf-8" }
      );
      return JSON.parse(stdout);
    } catch {
      // Simpler fallback
      try {
        const { stdout } = await execAsync(
          'powershell -Command "(Get-Process | Where-Object {$_.MainWindowTitle -ne \'\'} | Select-Object -First 1 ProcessName, MainWindowTitle, Id) | ConvertTo-Json"',
          { encoding: "utf-8" }
        );
        return JSON.parse(stdout);
      } catch {
        return { error: "Could not get active window" };
      }
    }
  },

  async clipboard_read(params) {
    try {
      const { stdout } = await execAsync(
        'powershell -Command "Get-Clipboard"',
        { encoding: "utf-8" }
      );
      return { text: stdout.trim() };
    } catch {
      return { text: "" };
    }
  },

  async clipboard_write(params) {
    // Escape for PowerShell
    const escaped = params.text.replace(/'/g, "''");
    await execAsync(
      `powershell -Command "Set-Clipboard -Value '${escaped}'"`,
      { encoding: "utf-8" }
    );
    return {};
  },

  async wait(params) {
    await new Promise((r) => setTimeout(r, params.ms));
    return {};
  },

  async wait_for_change(params) {
    const sharp = (await import("sharp")).default;
    const screenshot = (await import("screenshot-desktop")).default;

    const timeout = params.timeoutMs || 10000;
    const threshold = params.threshold || 0.05;
    const region = params.region;

    // Capture initial state
    const initial = await captureRegionBuffer(screenshot, sharp, region);
    const start = Date.now();

    while (Date.now() - start < timeout) {
      await new Promise((r) => setTimeout(r, 500));
      const current = await captureRegionBuffer(screenshot, sharp, region);

      // Compare buffers
      const diff = compareBuffers(initial, current);
      if (diff > threshold) {
        return { changed: true, elapsedMs: Date.now() - start, diff };
      }
    }

    return { changed: false, elapsedMs: Date.now() - start };
  },

  async ping_local(params) {
    const start = Date.now();
    return { latencyMs: Date.now() - start, status: "ok" };
  },
};

async function captureRegionBuffer(screenshot, sharp, region) {
  const buf = await screenshot({ format: "png" });
  if (region) {
    return sharp(buf).extract({
      left: region.x,
      top: region.y,
      width: region.width,
      height: region.height,
    }).raw().toBuffer();
  }
  return sharp(buf).resize(320, 180).raw().toBuffer();
}

function compareBuffers(a, b) {
  if (a.length !== b.length) return 1;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff += Math.abs(a[i] - b[i]);
  }
  return diff / (a.length * 255);
}
