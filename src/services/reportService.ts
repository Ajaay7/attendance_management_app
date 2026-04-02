import { db } from "../db/index";
import { records, persons } from "../db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

export interface AttendanceFilter {
  startDate?: string;
  endDate?: string;
  enrollId?: number;
  empId?: string;
  deviceSerialNum?: string;
}

export interface DailyReportRow {
  enrollId: number;
  empId: string | null;
  name: string;
  firstIn: string | null;
  lastOut: string | null;
  totalRecords: number;
  status: "Present" | "Absent";
}

export interface MonthlyReportRow {
  enrollId: number;
  empId: string | null;
  name: string;
  days: Record<number, "P" | "A">; // day number → P or A
  totalPresent: number;
  totalAbsent: number;
}

/**
 * Get filtered attendance records with person info enrichment.
 */
export async function getFilteredAttendance(filters: AttendanceFilter) {
  const conditions: any[] = [];

  if (filters.startDate) conditions.push(gte(records.recordTime, new Date(filters.startDate)));
  if (filters.endDate) {
    // End of day for endDate
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(records.recordTime, end));
  }
  if (filters.enrollId) conditions.push(eq(records.enrollId, filters.enrollId));
  if (filters.deviceSerialNum) conditions.push(eq(records.deviceSerialNum, filters.deviceSerialNum));

  // Resolve empId to enrollId
  if (filters.empId) {
    const personRows = await db.select({ id: persons.id }).from(persons)
      .where(eq(persons.empId, filters.empId));
    if (personRows.length > 0) {
      conditions.push(eq(records.enrollId, personRows[0].id));
    } else {
      return [];
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const data = await db.select().from(records)
    .where(whereClause)
    .orderBy(desc(records.recordTime));

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

  return data.map(r => ({
    ...r,
    empId: personMap[r.enrollId]?.empId || null,
    personName: personMap[r.enrollId]?.name || null,
  }));
}

/**
 * Daily attendance report for a specific date.
 * Returns one row per person: first-in, last-out, status.
 */
export async function getDailyReport(date: string): Promise<DailyReportRow[]> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  // Get all persons
  const allPersons = await db.select().from(persons);

  // Get all records for that day
  const dayRecords = await db.select().from(records)
    .where(and(gte(records.recordTime, dayStart), lte(records.recordTime, dayEnd)))
    .orderBy(records.recordTime);

  // Group records by enrollId
  const recordsByPerson: Record<number, typeof dayRecords> = {};
  for (const r of dayRecords) {
    if (!recordsByPerson[r.enrollId]) recordsByPerson[r.enrollId] = [];
    recordsByPerson[r.enrollId].push(r);
  }

  // Build report
  return allPersons.map(p => {
    const recs = recordsByPerson[p.id] || [];
    const firstIn = recs.length > 0 ? recs[0].recordTime.toISOString() : null;
    const lastOut = recs.length > 1 ? recs[recs.length - 1].recordTime.toISOString() : firstIn;

    return {
      enrollId: p.id,
      empId: p.empId,
      name: p.name,
      firstIn,
      lastOut,
      totalRecords: recs.length,
      status: recs.length > 0 ? "Present" as const : "Absent" as const,
    };
  });
}

/**
 * Monthly attendance summary.
 * Returns matrix: each person × each day of month → P or A.
 */
export async function getMonthlyReport(year: number, month: number): Promise<MonthlyReportRow[]> {
  const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999); // last day of month
  const daysInMonth = new Date(year, month, 0).getDate();

  // Get all persons
  const allPersons = await db.select().from(persons);

  // Get all records for that month
  const monthRecords = await db.select().from(records)
    .where(and(gte(records.recordTime, monthStart), lte(records.recordTime, monthEnd)));

  // Build a set of (enrollId, dayOfMonth) pairs that have records
  const presentSet = new Set<string>();
  for (const r of monthRecords) {
    const day = r.recordTime.getDate();
    presentSet.add(`${r.enrollId}_${day}`);
  }

  // Build report
  return allPersons.map(p => {
    const days: Record<number, "P" | "A"> = {};
    let totalPresent = 0;
    let totalAbsent = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const isPresent = presentSet.has(`${p.id}_${d}`);
      days[d] = isPresent ? "P" : "A";
      if (isPresent) totalPresent++;
      else totalAbsent++;
    }

    return {
      enrollId: p.id,
      empId: p.empId,
      name: p.name,
      days,
      totalPresent,
      totalAbsent,
    };
  });
}
