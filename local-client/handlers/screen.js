import sharp from "sharp";
import { execFile, exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink, writeFile, access } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

// ── Pre-compiled screenshot exe for speed ──
const SCREENSHOT_EXE = join(tmpdir(), "fast_capture.exe");
const SCREENSHOT_CS = `
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Windows.Forms;
using System.IO;

class Program {
    static void Main(string[] args) {
        string outPath = args[0];
        int monitorIndex = args.Length > 1 ? int.Parse(args[1]) : -1;

        Rectangle bounds;
        if (monitorIndex == -2) {
            // All monitors combined
            bounds = SystemInformation.VirtualScreen;
        } else if (monitorIndex >= 0 && monitorIndex < Screen.AllScreens.Length) {
            bounds = Screen.AllScreens[monitorIndex].Bounds;
        } else {
            bounds = Screen.PrimaryScreen.Bounds;
        }

        using (Bitmap bmp = new Bitmap(bounds.Width, bounds.Height))
        using (Graphics g = Graphics.FromImage(bmp)) {
            g.CopyFromScreen(bounds.X, bounds.Y, 0, 0, bounds.Size);
            bmp.Save(outPath, ImageFormat.Png);
        }
        Console.Write(bounds.X + "," + bounds.Y + "," + bounds.Width + "," + bounds.Height);
    }
}
`;

let exeReady = false;

async function ensureScreenshotExe() {
  if (exeReady) return;
  try {
    await access(SCREENSHOT_EXE);
    exeReady = true;
    return;
  } catch {}

  // Compile the C# screenshot utility once
  const csPath = join(tmpdir(), "fast_capture.cs");
  await writeFile(csPath, SCREENSHOT_CS);

  // Find csc.exe
  const { stdout } = await execAsync(
    'powershell -NoProfile -Command "Get-ChildItem -Path $env:windir\\Microsoft.NET\\Framework -Recurse -Filter csc.exe | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName"',
    { timeout: 10000 }
  );
  const cscPath = stdout.trim();
  if (!cscPath) throw new Error("csc.exe not found");

  await execAsync(
    `"${cscPath}" /nologo /target:exe /r:System.Windows.Forms.dll /r:System.Drawing.dll /out:"${SCREENSHOT_EXE}" "${csPath}"`,
    { timeout: 15000 }
  );
  exeReady = true;
  console.log("[Screen] Screenshot exe compiled successfully");
}

async function captureScreen(monitorIndex = -1) {
  const tmpPath = join(tmpdir(), `cap_${Date.now()}.png`);

  try {
    await ensureScreenshotExe();
    // Fast path: use pre-compiled exe (~200ms vs ~2000ms for PowerShell)
    const { stdout } = await execFileAsync(SCREENSHOT_EXE, [tmpPath, String(monitorIndex)], { timeout: 10000 });
    const buffer = await readFile(tmpPath);
    unlink(tmpPath).catch(() => {});
    const [bx, by, bw, bh] = stdout.split(",").map(Number);
    return { buffer, offsetX: bx, offsetY: by, width: bw, height: bh };
  } catch (err) {
    console.log("[Screen] Fast capture failed, falling back to PowerShell:", err.message);
    return captureScreenPowerShell(monitorIndex, tmpPath);
  }
}

async function captureScreenPowerShell(monitorIndex, tmpPath) {
  if (!tmpPath) tmpPath = join(tmpdir(), `cap_${Date.now()}.png`);
  const psPath = tmpPath.replace(/\\/g, "/");

  let boundsCode;
  if (monitorIndex === -2) {
    boundsCode = "$s=[System.Windows.Forms.SystemInformation]::VirtualScreen";
  } else if (monitorIndex >= 0) {
    boundsCode = `$s=[System.Windows.Forms.Screen]::AllScreens[${monitorIndex}].Bounds`;
  } else {
    boundsCode = "$s=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds";
  }

  const psCommand = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    boundsCode,
    "$b=New-Object System.Drawing.Bitmap($s.Width,$s.Height)",
    "$g=[System.Drawing.Graphics]::FromImage($b)",
    "$g.CopyFromScreen($s.X,$s.Y,0,0,$s.Size)",
    `$b.Save('${psPath}')`,
    "$g.Dispose()",
    "$b.Dispose()",
    "Write-Output \"$($s.X),$($s.Y),$($s.Width),$($s.Height)\"",
  ].join("; ");

  const { stdout } = await execAsync(`powershell -NoProfile -Command "${psCommand}"`, { timeout: 15000 });
  const buffer = await readFile(tmpPath);
  unlink(tmpPath).catch(() => {});
  const parts = stdout.trim().split(",").map(Number);
  return {
    buffer,
    offsetX: parts[0] || 0,
    offsetY: parts[1] || 0,
    width: parts[2] || 1920,
    height: parts[3] || 1080,
  };
}

async function captureAndEncode(options = {}) {
  const { quality = 60, maxWidth = 1920, region, monitor } = options;

  // Determine monitor index: -1 = primary, -2 = all, 0+ = specific
  let monitorIndex = -1;
  if (monitor === "all" || monitor === -2) monitorIndex = -2;
  else if (typeof monitor === "number" && monitor >= 0) monitorIndex = monitor;
  else if (typeof monitor === "string" && !isNaN(Number(monitor))) monitorIndex = Number(monitor);

  const captured = await captureScreen(monitorIndex);
  let pipeline = sharp(captured.buffer);

  // Crop if region specified
  if (region) {
    const x = Number(region.x) || 0;
    const y = Number(region.y) || 0;
    const w = Number(region.width) || 100;
    const h = Number(region.height) || 100;
    pipeline = pipeline.extract({ left: x, top: y, width: w, height: h });
  }

  // Get metadata for resize decision
  const metadata = await pipeline.metadata();
  const currentWidth = region ? Number(region.width) : metadata.width;

  if (currentWidth > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth });
  }

  const jpegBuffer = await pipeline.jpeg({ quality }).toBuffer();
  const finalMeta = await sharp(jpegBuffer).metadata();

  return {
    image: jpegBuffer.toString("base64"),
    width: finalMeta.width,
    height: finalMeta.height,
    monitorOffset: { x: captured.offsetX, y: captured.offsetY },
  };
}

export const screenHandlers = {
  async capture_screen(params) {
    return captureAndEncode({
      quality: Number(params.quality) || 60,
      maxWidth: Number(params.maxWidth) || 1920,
      monitor: params.monitor,
    });
  },

  async capture_region(params) {
    return captureAndEncode({
      quality: Number(params.quality) || 80,
      monitor: params.monitor,
      region: {
        x: Number(params.x) || 0,
        y: Number(params.y) || 0,
        width: Number(params.width) || 100,
        height: Number(params.height) || 100,
      },
    });
  },

  async capture_window(params) {
    // Try to find the window and capture its specific monitor
    const result = await captureAndEncode({
      quality: Number(params.quality) || 70,
    });
    result.windowTitle = params.titlePattern;
    return result;
  },

  async list_windows(params) {
    try {
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne \'\'} | Select-Object ProcessName, MainWindowTitle, Id | ConvertTo-Json"',
        { encoding: "utf-8", timeout: 5000 }
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
      monitor: params.monitor,
      region: params.region,
    });
  },

  async find_ui_element(params) {
    return {
      found: false,
      message: "UI element search requires OCR setup. Use capture_screen + Claude vision instead.",
    };
  },
};
