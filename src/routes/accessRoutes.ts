import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { accessDays, accessWeeks, lockGroups, userLocks } from "../db/schema";
import { eq } from "drizzle-orm";
import * as accessService from "../services/accessService";
import * as commandService from "../services/commandService";

const router = Router();

// POST /setAccessDay - Set daily time zones
router.post("/setAccessDay", async (req: Request, res: Response) => {
  const { deviceSn, dayZones } = req.body;
  // dayZones: [{ zoneIndex: 0, sections: ["06:00~18:00", ...] }, ...]

  if (!deviceSn || !dayZones) {
    res.status(400).json({ error: "deviceSn and dayZones required" });
    return;
  }

  await accessService.setAccessDay(deviceSn, dayZones);
  res.json({ message: "Access day zones saved", deviceSn });
});

// POST /setAccessWeek - Set weekly access rules
router.post("/setAccessWeek", async (req: Request, res: Response) => {
  const { deviceSn, weekZones } = req.body;
  // weekZones: [{ weekIndex: 0, days: [1,1,1,1,1,2,2] }, ...]

  if (!deviceSn || !weekZones) {
    res.status(400).json({ error: "deviceSn and weekZones required" });
    return;
  }

  await accessService.setAccessWeek(deviceSn, weekZones);
  res.json({ message: "Access week zones saved", deviceSn });
});

// POST /setLockGroup - Set lock groups
router.post("/setLockGroup", async (req: Request, res: Response) => {
  const { deviceSn, groups } = req.body;
  // groups: [{ groupIndex: 0, groupValue: "1234" }, ...]

  if (!deviceSn || !groups) {
    res.status(400).json({ error: "deviceSn and groups required" });
    return;
  }

  await accessService.setLockGroup(deviceSn, groups);
  res.json({ message: "Lock groups saved", deviceSn });
});

// POST /setDevLock - Set full access config and push to all devices
router.post("/setDevLock", async (req: Request, res: Response) => {
  const { dayZones, weekZones, groups } = req.body;

  await accessService.pushAccessConfigToAllDevices(
    dayZones || [],
    weekZones || [],
    groups || []
  );

  res.json({ message: "Access config pushed to all devices" });
});

// POST /setUserLock - Set user-specific access times
router.post("/setUserLock", async (req: Request, res: Response) => {
  const { deviceSn, userLocks: userLockInputs } = req.body;

  if (!deviceSn || !userLockInputs) {
    res.status(400).json({ error: "deviceSn and userLocks required" });
    return;
  }

  await accessService.setUserLock(deviceSn, userLockInputs);
  res.json({ message: "User locks set and command queued", deviceSn });
});

// GET /accessDays - Get all access day rules
router.get("/accessDays", async (req: Request, res: Response) => {
  const deviceSn = req.query.deviceSn as string;
  if (deviceSn) {
    const days = await db
      .select()
      .from(accessDays)
      .where(eq(accessDays.serialNum, deviceSn));
    res.json(days);
    return;
  }
  const allDays = await db.select().from(accessDays);
  res.json(allDays);
});

// GET /accessWeeks - Get all access week rules
router.get("/accessWeeks", async (req: Request, res: Response) => {
  const allWeeks = await db.select().from(accessWeeks);
  res.json(allWeeks);
});

// GET /getUserLock - Get user locks (requires enrollId)
router.get("/getUserLock", async (req: Request, res: Response) => {
  const enrollId = parseInt(req.query.enrollId as string);
  const deviceSn = req.query.deviceSn as string;

  if (!enrollId) {
    res.status(400).json({ error: "enrollId query parameter required" });
    return;
  }

  // If deviceSn provided, also request from device
  if (deviceSn) {
    await commandService.getUserLock(deviceSn, enrollId);
  }

  const locks = await db
    .select()
    .from(userLocks)
    .where(eq(userLocks.enrollId, enrollId));
  res.json(locks);
});

export default router;
