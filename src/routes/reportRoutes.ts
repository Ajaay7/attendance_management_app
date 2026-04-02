import { Router, Request, Response } from "express";
import * as reportService from "../services/reportService";
import {
  buildAttendanceWorkbook,
  buildDailyWorkbook,
  buildMonthlyWorkbook,
  sendWorkbook,
} from "../helpers/excelExport";

const router = Router();

/**
 * GET /api/reports/attendance
 * Download filtered attendance records.
 * Query: startDate, endDate, enrollId, empId, deviceSerialNum, format (json|csv|xlsx)
 */
router.get("/attendance", async (req: Request, res: Response) => {
  const format = (req.query.format as string) || "json";
  const filters: reportService.AttendanceFilter = {
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string,
    enrollId: req.query.enrollId ? parseInt(req.query.enrollId as string) : undefined,
    empId: req.query.empId as string,
    deviceSerialNum: req.query.deviceSerialNum as string,
  };

  const data = await reportService.getFilteredAttendance(filters);

  if (format === "xlsx") {
    const wb = buildAttendanceWorkbook(data);
    await sendWorkbook(res, wb, `attendance_${filters.startDate || "all"}_${filters.endDate || "all"}.xlsx`);
    return;
  }

  if (format === "csv") {
    const modeMap: Record<number, string> = { 0: "Fingerprint", 1: "Card", 2: "Password", 8: "Face" };
    const inOutMap: Record<number, string> = { 0: "IN", 1: "OUT" };
    let csv = "Terminal ID,Emp ID,Name,Record Time,Mode,In/Out,Event,Device,Temperature\n";
    for (const r of data) {
      const modeVal = r.mode ?? 0;
      const inOutVal = r.inOut ?? 0;
      csv += `${r.enrollId},"${r.empId || ""}","${r.personName || ""}","${r.recordTime ? new Date(r.recordTime).toLocaleString() : ""}",${modeMap[modeVal] || modeVal},${inOutMap[inOutVal] || inOutVal},${r.event},"${r.deviceSerialNum || ""}",${r.temperature || ""}\n`;
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="attendance.csv"`);
    res.send(csv);
    return;
  }

  res.json({ data, total: data.length });
});

/**
 * GET /api/reports/daily
 * Daily attendance report.
 * Query: date (YYYY-MM-DD, defaults to today), format (json|xlsx)
 */
router.get("/daily", async (req: Request, res: Response) => {
  const format = (req.query.format as string) || "json";
  const date = (req.query.date as string) || new Date().toISOString().split("T")[0];

  const data = await reportService.getDailyReport(date);

  if (format === "xlsx") {
    const wb = buildDailyWorkbook(data, date);
    await sendWorkbook(res, wb, `daily_report_${date}.xlsx`);
    return;
  }

  res.json({
    date,
    data,
    summary: {
      total: data.length,
      present: data.filter(r => r.status === "Present").length,
      absent: data.filter(r => r.status === "Absent").length,
    },
  });
});

/**
 * GET /api/reports/monthly
 * Monthly attendance summary (P/A matrix for all persons x all days).
 * Query: year, month, format (json|xlsx)
 */
router.get("/monthly", async (req: Request, res: Response) => {
  const format = (req.query.format as string) || "json";
  const now = new Date();
  const year = parseInt(req.query.year as string) || now.getFullYear();
  const month = parseInt(req.query.month as string) || (now.getMonth() + 1);

  const data = await reportService.getMonthlyReport(year, month);

  if (format === "xlsx") {
    const wb = buildMonthlyWorkbook(data, year, month);
    const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });
    await sendWorkbook(res, wb, `monthly_summary_${monthName}_${year}.xlsx`);
    return;
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  res.json({ year, month, daysInMonth, data });
});

export default router;
