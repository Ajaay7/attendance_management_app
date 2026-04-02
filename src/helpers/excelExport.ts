import ExcelJS from "exceljs";
import { Response } from "express";
import { DailyReportRow, MonthlyReportRow } from "../services/reportService";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D6EFD" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const PRESENT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
const ABSENT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin" }, bottom: { style: "thin" },
  left: { style: "thin" }, right: { style: "thin" },
};

/**
 * Send an ExcelJS workbook as a downloadable .xlsx file.
 */
export async function sendWorkbook(res: Response, workbook: ExcelJS.Workbook, filename: string) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

/**
 * Build attendance records Excel workbook.
 */
export function buildAttendanceWorkbook(data: any[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Attendance Records");

  const columns = [
    { header: "Terminal ID", key: "enrollId", width: 12 },
    { header: "Emp ID", key: "empId", width: 15 },
    { header: "Name", key: "personName", width: 20 },
    { header: "Record Time", key: "recordTime", width: 22 },
    { header: "Mode", key: "modeLabel", width: 12 },
    { header: "In/Out", key: "inOutLabel", width: 8 },
    { header: "Event", key: "event", width: 8 },
    { header: "Device", key: "deviceSerialNum", width: 18 },
    { header: "Temperature", key: "temperature", width: 12 },
  ];
  ws.columns = columns;

  const modeMap: Record<number, string> = { 0: "Fingerprint", 1: "Card", 2: "Password", 8: "Face" };
  const inOutMap: Record<number, string> = { 0: "IN", 1: "OUT" };

  for (const r of data) {
    ws.addRow({
      enrollId: r.enrollId,
      empId: r.empId || "-",
      personName: r.personName || "-",
      recordTime: r.recordTime ? new Date(r.recordTime).toLocaleString() : "-",
      modeLabel: modeMap[r.mode] || String(r.mode),
      inOutLabel: inOutMap[r.inOut] || String(r.inOut),
      event: r.event,
      deviceSerialNum: r.deviceSerialNum || "-",
      temperature: r.temperature ? r.temperature.toFixed(1) : "-",
    });
  }

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = BORDER_THIN;
    cell.alignment = { horizontal: "center" };
  });
  ws.autoFilter = { from: "A1", to: `I1` };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  return wb;
}

/**
 * Build daily attendance report Excel workbook.
 */
export function buildDailyWorkbook(data: DailyReportRow[], date: string): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Daily Report");

  // Title row
  ws.mergeCells("A1:H1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `Daily Attendance Report - ${date}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF0D6EFD" } };
  titleCell.alignment = { horizontal: "center" };

  // Headers in row 2
  const headers = ["Terminal ID", "Emp ID", "Name", "Status", "First In", "Last Out", "Total Punches"];
  ws.columns = [
    { width: 12 }, { width: 15 }, { width: 20 }, { width: 10 },
    { width: 22 }, { width: 22 }, { width: 14 },
  ];

  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = BORDER_THIN;
    cell.alignment = { horizontal: "center" };
  });

  // Data rows
  for (const r of data) {
    const row = ws.addRow([
      r.enrollId,
      r.empId || "-",
      r.name,
      r.status,
      r.firstIn ? new Date(r.firstIn).toLocaleTimeString() : "-",
      r.lastOut ? new Date(r.lastOut).toLocaleTimeString() : "-",
      r.totalRecords,
    ]);

    // Color the status cell
    const statusCell = row.getCell(4);
    statusCell.fill = r.status === "Present" ? PRESENT_FILL : ABSENT_FILL;
    statusCell.alignment = { horizontal: "center" };
    row.eachCell(cell => { cell.border = BORDER_THIN; });
  }

  ws.autoFilter = { from: "A2", to: "G2" };
  ws.views = [{ state: "frozen", ySplit: 2 }];

  return wb;
}

/**
 * Build monthly summary Excel workbook.
 * Rows = persons, Columns = days 1..N, with P/A colored cells.
 */
export function buildMonthlyWorkbook(data: MonthlyReportRow[], year: number, month: number): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Monthly Summary");
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });

  // Title row
  const totalCols = 3 + daysInMonth + 2; // TermID, EmpID, Name, day1..dayN, TotalP, TotalA
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell("A1");
  titleCell.value = `Monthly Attendance Summary - ${monthName} ${year}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF0D6EFD" } };
  titleCell.alignment = { horizontal: "center" };

  // Header row (row 2)
  const headerRow = ws.getRow(2);
  const headerValues: string[] = ["Terminal ID", "Emp ID", "Name"];
  for (let d = 1; d <= daysInMonth; d++) headerValues.push(String(d));
  headerValues.push("Total Present", "Total Absent");

  headerValues.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = BORDER_THIN;
    cell.alignment = { horizontal: "center" };
  });

  // Set column widths
  ws.getColumn(1).width = 12; // Terminal ID
  ws.getColumn(2).width = 15; // Emp ID
  ws.getColumn(3).width = 20; // Name
  for (let d = 1; d <= daysInMonth; d++) ws.getColumn(3 + d).width = 4.5;
  ws.getColumn(3 + daysInMonth + 1).width = 14; // Total Present
  ws.getColumn(3 + daysInMonth + 2).width = 12; // Total Absent

  // Data rows
  for (const r of data) {
    const rowValues: (string | number)[] = [
      r.enrollId,
      r.empId || "-",
      r.name,
    ];
    for (let d = 1; d <= daysInMonth; d++) rowValues.push(r.days[d]);
    rowValues.push(r.totalPresent, r.totalAbsent);

    const row = ws.addRow(rowValues);

    // Color P/A cells
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = row.getCell(3 + d);
      cell.alignment = { horizontal: "center" };
      cell.border = BORDER_THIN;
      if (r.days[d] === "P") {
        cell.fill = PRESENT_FILL;
        cell.font = { bold: true, color: { argb: "FF006100" } };
      } else {
        cell.fill = ABSENT_FILL;
        cell.font = { color: { argb: "FF9C0006" } };
      }
    }

    // Style fixed columns
    row.getCell(1).border = BORDER_THIN;
    row.getCell(2).border = BORDER_THIN;
    row.getCell(3).border = BORDER_THIN;

    // Summary columns bold
    const pCell = row.getCell(3 + daysInMonth + 1);
    pCell.border = BORDER_THIN;
    pCell.font = { bold: true, color: { argb: "FF006100" } };
    pCell.alignment = { horizontal: "center" };

    const aCell = row.getCell(3 + daysInMonth + 2);
    aCell.border = BORDER_THIN;
    aCell.font = { bold: true, color: { argb: "FF9C0006" } };
    aCell.alignment = { horizontal: "center" };
  }

  // Freeze first 3 columns and 2 rows
  ws.views = [{ state: "frozen", xSplit: 3, ySplit: 2 }];
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: totalCols } };

  return wb;
}
