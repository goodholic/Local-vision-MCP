import "dotenv/config";
import { io } from "socket.io-client";
import { handleCommand } from "./handlers/router.js";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const SECRET = process.env.LOCAL_CLIENT_SECRET || "changeme";

console.log(`[Local Client] Connecting to ${SERVER_URL}...`);

const socket = io(SERVER_URL, {
  auth: { secret: SECRET },
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  timeout: 20000,
});

socket.on("connect", () => {
  console.log(`[Local Client] Connected! Socket ID: ${socket.id}`);
});

socket.on("disconnect", (reason) => {
  console.log(`[Local Client] Disconnected: ${reason}`);
});

socket.on("connect_error", (err) => {
  console.error(`[Local Client] Connection error: ${err.message}`);
});

// ─── Command handler ─────────────────────────────────────────────
socket.on("command", async ({ id, command, params }) => {
  console.log(`[Command] ${command} (${id})`);
  try {
    const result = await handleCommand(command, params);
    socket.emit("command-result", { id, result });
    console.log(`[Command] ${command} completed`);
  } catch (err) {
    console.error(`[Command] ${command} failed:`, err.message);
    socket.emit("command-result", { id, error: err.message });
  }
});

// ─── Graceful shutdown ───────────────────────────────────────────
process.on("SIGINT", () => {
  console.log("\n[Local Client] Shutting down...");
  socket.disconnect();
  process.exit(0);
});

process.on("SIGTERM", () => {
  socket.disconnect();
  process.exit(0);
});
