import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { records, persons, devices } from "../db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

const router = Router();

/**
 * GET /api/external/attendance
 * Filtered attendance records for HRMS integration.
 * Query params: startDate, endDate, enrollId, empId, deviceSerialNum, page, limit
 */
router.get("/attendance", async (req: Request, res: Response) => {
  const { startDate, endDate, enrollId, empId, deviceSerialNum } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const offset = (page - 1) * limit;

  // Build WHERE conditions
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(records.recordTime, new Date(startDate as string)));
  if (endDate) conditions.push(lte(records.recordTime, new Date(endDate as string)));
  if (enrollId) conditions.push(eq(records.enrollId, parseInt(enrollId as string)));
  if (deviceSerialNum) conditions.push(eq(records.deviceSerialNum, deviceSerialNum as string));

  // If empId filter, resolve to enrollId first
  if (empId) {
    const personRows = await db.select({ id: persons.id }).from(persons)
      .where(eq(persons.empId, empId as string));
    if (personRows.length > 0) {
      conditions.push(eq(records.enrollId, personRows[0].id));
    } else {
      res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      return;
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(records)
    .where(whereClause);
  const total = countResult[0]?.count || 0;

  // Get paginated data
  const data = await db.select().from(records)
    .where(whereClause)
    .orderBy(desc(records.recordTime))
    .limit(limit).offset(offset);

  // Enrich with person info
  const enrollIds = [...new Set(data.map(r => r.enrollId))];
  let personMap: Record<number, { empId: string | null; name: string }> = {};
  if (enrollIds.length > 0) {
    const personRows = await db
      .select({ id: persons.id, empId: persons.empId, name: persons.name })
      .from(persons)
      .where(sql`${persons.id} IN (${sql.join(enrollIds.map(id => sql`${id}`), sql`, `)})`);
    for (const p of personRows) {
      personMap[p.id] = { empId: p.empId, name: p.name };
    }
  }

  const enrichedData = data.map(r => ({
    ...r,
    empId: personMap[r.enrollId]?.empId || null,
    personName: personMap[r.enrollId]?.name || null,
  }));

  res.json({
    data: enrichedData,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * GET /api/external/persons
 * List all persons with empId mapping.
 */
router.get("/persons", async (_req: Request, res: Response) => {
  const allPersons = await db.select().from(persons);
  res.json(allPersons);
});

/**
 * GET /api/external/devices
 * List all devices with online status.
 */
router.get("/devices", async (_req: Request, res: Response) => {
  const allDevices = await db.select().from(devices);
  res.json(allDevices);
});

export default router;
