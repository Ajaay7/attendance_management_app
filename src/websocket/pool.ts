import WebSocket from "ws";

export interface DeviceConnection {
  serialNum: string;
  ws: WebSocket;
  status: number; // 1: connected
}

// Global device connection pool
const devicePool = new Map<string, DeviceConnection>();

export const wsPool = {
  addDevice(serialNum: string, ws: WebSocket): void {
    devicePool.set(serialNum, { serialNum, ws, status: 1 });
  },

  getDevice(serialNum: string): DeviceConnection | undefined {
    return devicePool.get(serialNum);
  },

  getWebSocket(serialNum: string): WebSocket | undefined {
    const device = devicePool.get(serialNum);
    return device?.ws;
  },

  removeDevice(serialNum: string): void {
    devicePool.delete(serialNum);
  },

  removeByWebSocket(ws: WebSocket): string | undefined {
    for (const [sn, device] of devicePool.entries()) {
      if (device.ws === ws) {
        devicePool.delete(sn);
        return sn;
      }
    }
    return undefined;
  },

  sendMessage(serialNum: string, message: object): boolean {
    const device = devicePool.get(serialNum);
    if (device && device.ws.readyState === WebSocket.OPEN) {
      device.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  },

  isOnline(serialNum: string): boolean {
    const device = devicePool.get(serialNum);
    return !!device && device.ws.readyState === WebSocket.OPEN;
  },

  getAllDevices(): Map<string, DeviceConnection> {
    return devicePool;
  },

  getOnlineSerials(): string[] {
    const online: string[] = [];
    for (const [sn, device] of devicePool.entries()) {
      if (device.ws.readyState === WebSocket.OPEN) {
        online.push(sn);
      }
    }
    return online;
  },
};
