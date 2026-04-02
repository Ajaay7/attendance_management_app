import { Router, Request, Response } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import path from "path";
import { db } from "../db/index";
import { persons, enrollInfos, devices } from "../db/schema";
import { eq } from "drizzle-orm";
import { config } from "../config/index";
import * as personService from "../services/personService";
import { saveBase64Image } from "../helpers/image";
import fs from "fs";

const router = Router();

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = config.upload.path;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// Helper: parse Excel file using ExcelJS
async function parseExcel(filePath: string): Promise<Record<string, any>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers: string[] = [];
  const rows: Record<string, any>[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // Header row
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || "").trim();
      });
    } else {
      // Data rows
      const obj: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) obj[header] = cell.value;
      });
      if (Object.keys(obj).length > 0) rows.push(obj);
    }
  });

  return rows;
}

// POST /addPerson - Add a single person with optional photo upload
router.post("/addPerson", upload.single("photo"), async (req: Request, res: Response) => {
  const { name, rollId, alias, enrollId, admin } = req.body;

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const personEnrollId = parseInt(enrollId) || 0;
  const personAdmin = parseInt(admin) || 0;

  // Create person
  const [person] = await db
    .insert(persons)
    .values({
      name,
      rollId: parseInt(rollId) || 0,
      alias: alias || null,
    })
    .returning();

  // If photo provided, create enrollment info with face data (backupnum=50)
  if (req.file) {
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64 = imageBuffer.toString("base64");

    await db.insert(enrollInfos).values({
      enrollId: personEnrollId || person.id,
      backupnum: 50,
      imagePath: req.file.filename,
      signatures: base64,
      name,
      admin: personAdmin,
    });
  }

  res.status(201).json({ message: "Person added", person });
});

// POST /uploadPerson - Batch upload persons from Excel
router.post("/uploadPerson", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "Excel file required" });
    return;
  }

  const rows = await parseExcel(req.file.path);

  let added = 0;
  for (const row of rows) {
    const name = row.name || row.Name || "";
    const enrollId = parseInt(row.enrollId || row.EnrollId || row.enrollid || "0");
    const rollId = parseInt(row.rollId || row.RollId || "0");

    if (!name) continue;

    const [person] = await db
      .insert(persons)
      .values({ name, rollId })
      .returning();

    // If a photo path column exists in Excel, read and store
    const photoPath = row.photo || row.Photo || "";
    if (photoPath && fs.existsSync(String(photoPath))) {
      const imageBuffer = fs.readFileSync(String(photoPath));
      const base64 = imageBuffer.toString("base64");
      const fileName = await saveBase64Image(base64);

      await db.insert(enrollInfos).values({
        enrollId: enrollId || person.id,
        backupnum: 50,
        imagePath: fileName,
        signatures: base64,
        name,
        admin: 0,
      });
    }

    added++;
  }

  res.json({ message: `${added} persons uploaded` });
});

// POST /deleteUsersFromExcel - Batch delete from Excel
router.post("/deleteUsersFromExcel", upload.single("file"), async (req: Request, res: Response) => {
  const deviceSn = req.body.deviceSn as string;

  if (!req.file) {
    res.status(400).json({ error: "Excel file required" });
    return;
  }

  const rows = await parseExcel(req.file.path);

  let deleted = 0;
  for (const row of rows) {
    const enrollId = parseInt(row.enrollId || row.EnrollId || row.enrollid || "0");
    if (!enrollId) continue;

    // Delete from DB
    await db.delete(enrollInfos).where(eq(enrollInfos.enrollId, enrollId));
    await db.delete(persons).where(eq(persons.id, enrollId));

    // If deviceSn provided, also delete from device
    if (deviceSn) {
      await personService.deleteUserFromDevice(deviceSn, enrollId);
    } else {
      // Delete from all devices
      const allDevices = await db.select().from(devices);
      for (const device of allDevices) {
        await personService.deleteUserFromDevice(device.serialNum, enrollId);
      }
    }

    deleted++;
  }

  res.json({ message: `${deleted} persons deleted` });
});

// GET /emps - Get all employees with pagination
router.get("/emps", async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  const allPersons = await db.select().from(persons);
  const total = allPersons.length;
  const paged = allPersons.slice(offset, offset + limit);

  res.json({
    data: paged,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /getUserInfo - Get user enrollment data from DB
router.get("/getUserInfo", async (req: Request, res: Response) => {
  const enrollId = parseInt(req.query.enrollId as string);
  if (!enrollId) {
    res.status(400).json({ error: "enrollId query parameter required" });
    return;
  }

  const info = await db
    .select()
    .from(enrollInfos)
    .where(eq(enrollInfos.enrollId, enrollId));

  res.json(info);
});

// GET /sendGetUserInfo - Request specific user info from device
router.get("/sendGetUserInfo", async (req: Request, res: Response) => {
  const deviceSn = req.query.deviceSn as string;
  const enrollId = parseInt(req.query.enrollId as string);
  const backupnum = parseInt(req.query.backupnum as string) || 50;

  if (!deviceSn || !enrollId) {
    res.status(400).json({ error: "deviceSn and enrollId required" });
    return;
  }

  await personService.getUserInfoFromDevice(deviceSn, enrollId, backupnum);
  res.json({ message: "getuserinfo command queued", deviceSn, enrollId });
});

// GET /setPersonToDevice - Push ALL users to a device
router.get("/setPersonToDevice", async (req: Request, res: Response) => {
  const deviceSn = req.query.deviceSn as string;
  if (!deviceSn) {
    res.status(400).json({ error: "deviceSn query parameter required" });
    return;
  }

  await personService.setAllUsersToDevice(deviceSn);
  res.json({ message: "All users queued for push to device", deviceSn });
});

// GET /setUsernameToDevice - Push names to device
router.get("/setUsernameToDevice", async (req: Request, res: Response) => {
  const deviceSn = req.query.deviceSn as string;
  if (!deviceSn) {
    res.status(400).json({ error: "deviceSn query parameter required" });
    return;
  }

  await personService.setUsernameToDevice(deviceSn);
  res.json({ message: "Usernames queued for push to device", deviceSn });
});

// GET /setOneUser - Push single user to device
router.get("/setOneUser", async (req: Request, res: Response) => {
  const deviceSn = req.query.deviceSn as string;
  const enrollId = parseInt(req.query.enrollId as string);

  if (!deviceSn || !enrollId) {
    res.status(400).json({ error: "deviceSn and enrollId required" });
    return;
  }

  await personService.setUserToDevice(deviceSn, enrollId);
  res.json({ message: "User queued for push to device", deviceSn, enrollId });
});

// GET /deletePersonFromDevice - Delete user from device
router.get("/deletePersonFromDevice", async (req: Request, res: Response) => {
  const deviceSn = req.query.deviceSn as string;
  const enrollId = parseInt(req.query.enrollId as string);
  const backupnum = parseInt(req.query.backupnum as string) || 13;

  if (!deviceSn || !enrollId) {
    res.status(400).json({ error: "deviceSn and enrollId required" });
    return;
  }

  await personService.deleteUserFromDevice(deviceSn, enrollId, backupnum);
  res.json({ message: "Delete user command queued", deviceSn, enrollId });
});

// GET /enrollInfo - Get all enrollment information
router.get("/enrollInfo", async (_req: Request, res: Response) => {
  const allEnroll = await db.select().from(enrollInfos);
  res.json(allEnroll);
});

export default router;
