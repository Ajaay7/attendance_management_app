import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { records } from "../db/schema";
import * as commandService from "../services/commandService";

const router = Router();

// GET /records - Get all attendance records with pagination
router.get("/records", async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const allRecords = await db.select().from(records);
  const total = allRecords.length;
  const paged = allRecords.slice(offset, offset + limit);

  res.json({
    data: paged,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /getAllLog - Get all logs from device
router.get("/getAllLog", async (req: Request, res: Response) => {
  const deviceSn = req.query.deviceSn as string;
  if (!deviceSn) {
    res.status(400).json({ error: "deviceSn query parameter required" });
    return;
  }
  await commandService.getAllLog(deviceSn);
  res.json({ message: "getalllog command queued", deviceSn });
});

// GET /getNewLog - Get new logs from device
router.get("/getNewLog", async (req: Request, res: Response) => {
  const deviceSn = req.query.deviceSn as string;
  if (!deviceSn) {
    res.status(400).json({ error: "deviceSn query parameter required" });
    return;
  }
  await commandService.getNewLog(deviceSn);
  res.json({ message: "getnewlog command queued", deviceSn });
});

export default router;
