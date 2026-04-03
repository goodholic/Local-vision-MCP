import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { registerTools } from "./tools/index.js";

const PORT = process.env.PORT || 3000;
const LOCAL_CLIENT_SECRET = process.env.LOCAL_CLIENT_SECRET || "changeme";

// ─── Express + HTTP + Socket.io ───────────────────────────────────
const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: { origin: "*" },
  pingInterval: 10000,
  pingTimeout: 30000,
});

// ─── Local PC connection management ──────────────────────────────
let localClient = null;
const pendingCommands = new Map(); // id → { resolve, reject, timer }

io.use((socket, next) => {
  if (socket.handshake.auth?.secret === LOCAL_CLIENT_SECRET) {
    return next();
  }
  next(new Error("Authentication failed"));
});

io.on("connection", (socket) => {
  console.log(`[Socket.io] Local client connected: ${socket.id}`);
  localClient = socket;

  socket.on("command-result", ({ id, result, error }) => {
    const pending = pendingCommands.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingCommands.delete(id);
    if (error) {
      pending.reject(new Error(error));
    } else {
      pending.resolve(result);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`[Socket.io] Local client disconnected: ${reason}`);
    if (localClient?.id === socket.id) {
      localClient = null;
    }
    // Reject all pending commands
    for (const [id, pending] of pendingCommands) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Local client disconnected"));
      pendingCommands.delete(id);
    }
  });
});

// ─── Send command to local PC and wait for result ────────────────
export function sendCommand(command, params = {}, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    if (!localClient || !localClient.connected) {
      return reject(new Error("로컬 PC가 연결되어 있지 않습니다. local-client를 실행해 주세요."));
    }
    const id = uuidv4();
    const timer = setTimeout(() => {
      pendingCommands.delete(id);
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
    }, timeoutMs);

    pendingCommands.set(id, { resolve, reject, timer });
    localClient.emit("command", { id, command, params });
  });
}

// ─── Health / status endpoint ────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    localClientConnected: !!localClient?.connected,
    pendingCommands: pendingCommands.size,
  });
});

// ─── MCP Server ──────────────────────────────────────────────────
const mcpServer = new McpServer({
  name: "local-vision-mcp",
  version: "1.0.0",
  description: "로컬 PC의 화면을 보고, 마우스/키보드를 제어하여 게임을 만들 수 있는 MCP",
});

// Register all tools
registerTools(mcpServer, sendCommand);

// ─── SSE Transport for MCP ───────────────────────────────────────
const transports = {};

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  console.log(`[MCP] SSE session started: ${transport.sessionId}`);

  res.on("close", () => {
    delete transports[transport.sessionId];
    console.log(`[MCP] SSE session closed: ${transport.sessionId}`);
  });

  await mcpServer.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (!transport) {
    return res.status(404).json({ error: "Session not found" });
  }
  await transport.handlePostMessage(req, res);
});

// ─── Start ───────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[Server] MCP SSE server listening on port ${PORT}`);
  console.log(`[Server] SSE endpoint: /sse`);
  console.log(`[Server] Socket.io ready for local client connection`);
});
