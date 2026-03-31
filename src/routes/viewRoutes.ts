import { Router, Request, Response } from "express";
import path from "path";

const router = Router();

// Main dashboard - Staff List
router.get("/", (_req: Request, res: Response) => {
  res.render("index");
});

// Attendance Log Records page
router.get("/logRecords", (_req: Request, res: Response) => {
  res.render("logRecords");
});

export default router;
