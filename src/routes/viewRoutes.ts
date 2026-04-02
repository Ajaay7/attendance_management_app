import { Router, Request, Response } from "express";
import { requireAuthView } from "../middleware/auth";

const router = Router();

// Public: Login page
router.get("/login", (req: Request, res: Response) => {
  // If already logged in, redirect to dashboard
  const token = req.cookies?.token;
  if (token) return res.redirect("/");
  res.render("login");
});

// Protected view routes
router.get("/", requireAuthView, (_req: Request, res: Response) => {
  res.render("index");
});

router.get("/logRecords", requireAuthView, (_req: Request, res: Response) => {
  res.render("logRecords");
});

router.get("/reports", requireAuthView, (_req: Request, res: Response) => {
  res.render("reports");
});

export default router;
