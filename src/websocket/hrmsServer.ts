import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { config } from "../config/index";
import { logger } from "../helpers/logger";
import url from "url";

// Connected HRMS clients
const hrmsClients: Set<WebSocket> = new Set();

/**
 * Initialize the HRMS WebSocket server on the HTTP server.
 * Clients connect to ws://host:port/ws/attendance?apiKey=<EXTERNAL_API_KEY>
 */
export function setupHrmsWebSocket(server: any): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: IncomingMessage, socket: any, head: Buffer) => {
    const pathname = url.parse(request.url || "").pathname;

    if (pathname === "/ws/attendance") {
      // Validate API key from query string
      const parsed = url.parse(request.url || "", true);
      const apiKey = parsed.query.apiKey as string;

      if (config.auth.externalApiKey && apiKey !== config.auth.externalApiKey) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
    // Don't handle other paths — let them fall through (device WS is on a separate port)
  });

  wss.on("connection", (ws: WebSocket) => {
    hrmsClients.add(ws);
    logger.info(`HRMS WebSocket client connected. Total: ${hrmsClients.size}`);

    ws.on("close", () => {
      hrmsClients.delete(ws);
      logger.info(`HRMS WebSocket client disconnected. Total: ${hrmsClients.size}`);
    });

    ws.on("error", () => {
      hrmsClients.delete(ws);
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: "connected", message: "AMS HRMS real-time feed" }));
  });
}

/**
 * Broadcast a new attendance record to all connected HRMS clients.
 * Called from handler.ts when a sendlog record arrives from a device.
 */
export function broadcastAttendance(record: {
  enrollId: number;
  empId?: string | null;
  personName?: string | null;
  recordTime: string;
  mode: number;
  inOut: number;
  event: number;
  deviceSerialNum: string;
  temperature: number | null;
  image: string | null;
}): void {
  if (hrmsClients.size === 0) return;

  const payload = JSON.stringify({ type: "attendance", data: record });

  for (const client of hrmsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch {
        hrmsClients.delete(client);
      }
    }
  }
}
