import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/index";
import { appUsers } from "../db/schema";
import { eq } from "drizzle-orm";
import { config } from "../config/index";
import { requireMasterKey, requireAuth } from "../middleware/auth";

const router = Router();

/**
 * POST /auth/create-user
 * Protected by master API key. Creates a new app user.
 * Body: { username, password, role? }
 */
router.post("/create-user", requireMasterKey, async (req: Request, res: Response) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  // Check if user already exists
  const existing = await db.select().from(appUsers).where(eq(appUsers.username, username));
  if (existing.length > 0) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(appUsers)
    .values({
      username,
      passwordHash,
      role: role || "user",
    })
    .returning({ id: appUsers.id, username: appUsers.username, role: appUsers.role });

  res.status(201).json({ message: "User created", user });
});

/**
 * POST /auth/login
 * Body: { username, password }
 * Returns JWT in httpOnly cookie + JSON response.
 */
router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const users = await db.select().from(appUsers).where(eq(appUsers.username, username));
  if (users.length === 0) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const user = users[0];
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.auth.jwtSecret as string
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: false, // set true if using HTTPS
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  });

  res.json({ message: "Login successful", user: { id: user.id, username: user.username, role: user.role } });
});

/**
 * POST /auth/logout
 * Clears the auth cookie.
 */
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

/**
 * GET /auth/me
 * Returns current user info from JWT.
 */
router.get("/me", requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

export default router;
