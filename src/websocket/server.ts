import { WebSocketServer, WebSocket } from "ws";
import { config } from "../config";
import { wsPool } from "./pool";
import { handleDeviceMessage } from "./handler";
import { logger } from "../helpers/logger";
import { db } from "../db";
import { devices } from "../db/schema";
import { eq } from "drizzle-orm";

export function startWebSocketServer() {
  const wss = new WebSocketServer({ port: config.websocket.port });

  logger.info(`WebSocket server started on port ${config.websocket.port}`);

  wss.on("connection", (ws: WebSocket) => {
    logger.info("New device WebSocket connection");

    ws.on("message", async (raw: Buffer) => {
      const message = raw.toString();
      try {
        await handleDeviceMessage(ws, message);
      } catch (err: any) {
        logger.error("Error handling device message", err.message);
      }
    });

    ws.on("close", async () => {
      const sn = wsPool.removeByWebSocket(ws);
      if (sn) {
        logger.info(`Device disconnected: ${sn}`);
        // Mark device as offline
        await db
          .update(devices)
          .set({ status: 0, updatedAt: new Date() })
          .where(eq(devices.serialNum, sn));
      }
    });

    ws.on("error", (err) => {
      logger.error("WebSocket error", err.message);
      const sn = wsPool.removeByWebSocket(ws);
      if (sn) {
        logger.info(`Device error disconnect: ${sn}`);
      }
    });
  });

  return wss;
}
