import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { devices } from "../db/schema";
import { eq } from "drizzle-orm";
import * as commandService from "../services/commandService";
import { wsPool } from "../websocket/pool";

const router = Router();

// POST /device - Create a new device
router.post("/device", async (req: Request, res: Response) => {
  const { serialNum } = req.body;
  if (!serialNum) {
    res.status(400).json({ error: "serialNum is required" });
    return;
  }

  const existing = await db.select().from(devices).where(eq(devices.serialNum, serialNum));
  if (existing.length > 0) {
    res.status(409).json({ error: "Device already exists" });
    return;
  }

  const [device] = await db
    .insert(devices)
    .values({ serialNum, status: 0 })
    .returning();

  res.status(201).json(device);
});

// GET /device - Get all devices
router.get("/device", async (_req: Request, res: Response) => {
  const allDevices = await db.select().from(devices);
  // Augment with online status from pool
  const result = allDevices.map((d) => ({
    ...d,
    online: wsPool.isOnline(d.serialNum),
  }));
  res.json(result);
});

// GET /getDeviceInfo - Get device info from terminal
router.get("/getDeviceInfo", async (req: Request, res: Response) => {
  const deviceSn = req.query.deviceSn as string;
  if (!deviceSn) {
    res.status(400).json({ error: "deviceSn query parameter required" });
    return;
  }
  await commandService.getDeviceInfo(deviceSn);
  res.json({ message: "getdevinfo command queued", deviceSn });
});

// GET /openDoor - Open door
router.get("/openDoor", async (req: Request, res: Response) => {
  const deviceSn = req.query.deviceSn as string;
  const doorNum = req.query.doorNum ? parseInt(req.query.doorNum as string) : undefined;
  if (!deviceSn) {
    res.status(400).json({ error: "deviceSn query parameter required" });
    return;
  }
  await commandService.openDoor(deviceSn, doorNum);
  res.json({ message: "opendoor command queued", deviceSn });
});

// GET /initSystem - Initialize system
router.get("/initSystem", async (req: Request, res: Response) => {
  const deviceSn = req.query.deviceSn as string;
  if (!deviceSn) {
    res.status(400).json({ error: "deviceSn query parameter required" });
    return;
  }
  await commandService.initSystem(deviceSn);
  res.json({ message: "initsys command queued", deviceSn });
});

// GET /cleanAdmin - Clean admin users
router.get("/cleanAdmin", async (req: Request, res: Response) => {
  const deviceSn = req.query.deviceSn as string;
  if (!deviceSn) {
    res.status(400).json({ error: "deviceSn query parameter required" });
    return;
  }
  await commandService.cleanAdmin(deviceSn);
  res.json({ message: "cleanadmin command queued", deviceSn });
});

// GET /reboot - Reboot device
router.get("/reboot", async (req: Request, res: Response) => {
  const deviceSn = req.query.deviceSn as string;
  if (!deviceSn) {
    res.status(400).json({ error: "deviceSn query parameter required" });
    return;
  }
  await commandService.rebootDevice(deviceSn);
  res.json({ message: "reboot command queued", deviceSn });
});

// GET /getDevLock - Get device access lock parameters
router.get("/getDevLock", async (req: Request, res: Response) => {
  const deviceSn = req.query.deviceSn as string;
  if (!deviceSn) {
    res.status(400).json({ error: "deviceSn query parameter required" });
    return;
  }
  await commandService.getDevLock(deviceSn);
  res.json({ message: "getdevlock command queued", deviceSn });
});

export default router;
