import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { records, persons } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import * as commandService from "../services/commandService";

const router = Router();

// GET /records - Get all attendance records with pagination (includes empId & name from persons)
router.get("/records", async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const allRecords = await db.select().from(records);
  const total = allRecords.length;
  const paged = allRecords.slice(offset, offset + limit);

  // Enrich with empId and name from persons table
  const enrollIds = [...new Set(paged.map((r) => r.enrollId))];
  let personMap: Record<number, { empId: string | null; name: string }> = {};

  if (enrollIds.length > 0) {
    const personRows = await db
      .select({ id: persons.id, empId: persons.empId, name: persons.name })
      .from(persons)
      .where(sql`${persons.id} IN (${sql.join(enrollIds.map((id) => sql`${id}`), sql`, `)})`);
    for (const p of personRows) {
      personMap[p.id] = { empId: p.empId, name: p.name };
    }
  }

  const dataWithPerson = paged.map((r) => ({
    ...r,
    empId: personMap[r.enrollId]?.empId || null,
    personName: personMap[r.enrollId]?.name || null,
  }));

  res.json({
    data: dataWithPerson,
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
