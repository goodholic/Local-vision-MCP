import { readFile, writeFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const fileHandlers = {
  async local_read_file(params) {
    const content = await readFile(params.path, params.encoding || "utf-8");
    return { content };
  },

  async local_write_file(params) {
    await writeFile(params.path, params.content, params.encoding || "utf-8");
    return {};
  },

  async local_list_directory(params) {
    const entries = [];
    const maxDepth = params.maxDepth || 3;

    async function walk(dir, depth) {
      if (depth > maxDepth) return;
      const items = await readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = join(dir, item.name);
        const entry = {
          name: item.name,
          path: fullPath,
          isDirectory: item.isDirectory(),
        };
        if (!item.isDirectory()) {
          try {
            const s = await stat(fullPath);
            entry.size = s.size;
          } catch { /* skip */ }
        }
        entries.push(entry);
        if (params.recursive && item.isDirectory() && !item.name.startsWith(".")) {
          await walk(fullPath, depth + 1);
        }
      }
    }

    await walk(params.path, 0);
    return { entries };
  },

  async local_run_command(params) {
    const timeout = params.timeoutMs || 30000;
    try {
      const { stdout, stderr } = await execAsync(params.command, {
        cwd: params.cwd,
        timeout,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024 * 10, // 10MB
      });
      return { exitCode: 0, stdout, stderr };
    } catch (err) {
      return {
        exitCode: err.code || 1,
        stdout: err.stdout || "",
        stderr: err.stderr || err.message,
      };
    }
  },
};
