import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index";

// Extend Express Request to carry user info
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; username: string; role: string };
    }
  }
}

/**
 * Middleware: Require Master API Key (for user creation endpoint).
 * Expects: Authorization: Bearer <MASTER_API_KEY>
 */
export function requireMasterKey(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!config.auth.masterApiKey) {
    res.status(500).json({ error: "Master API key not configured on server" });
    return;
  }

  if (token !== config.auth.masterApiKey) {
    res.status(403).json({ error: "Invalid master API key" });
    return;
  }

  next();
}

/**
 * Middleware: Require JWT auth (for UI/API routes).
 * Checks: cookie "token" OR Authorization: Bearer <jwt>
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "");

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as {
      id: number;
      username: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Middleware: Require JWT for view pages (redirects to /login instead of 401).
 */
export function requireAuthView(req: Request, res: Response, next: NextFunction): void {
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "");

  if (!token) {
    res.redirect("/login");
    return;
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as {
      id: number;
      username: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch (err) {
    res.redirect("/login");
  }
}

/**
 * Middleware: Require External API Key (for HRMS integration).
 * Checks: X-API-Key header OR ?apiKey query param
 */
export function requireExternalApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey =
    (req.headers["x-api-key"] as string) || (req.query.apiKey as string) || "";

  if (!config.auth.externalApiKey) {
    res.status(500).json({ error: "External API key not configured on server" });
    return;
  }

  if (apiKey !== config.auth.externalApiKey) {
    res.status(403).json({ error: "Invalid API key" });
    return;
  }

  next();
}
