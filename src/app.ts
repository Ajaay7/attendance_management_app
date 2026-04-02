import express from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import http from "http";
import { config } from "./config/index";
import { logger } from "./helpers/logger";
import { startWebSocketServer } from "./websocket/server";
import { startSendOrderJob } from "./jobs/sendOrderJob";
import { setupHrmsWebSocket } from "./websocket/hrmsServer";
import { requireAuth, requireExternalApiKey } from "./middleware/auth";

// Routes
import authRoutes from "./routes/authRoutes";
import deviceRoutes from "./routes/deviceRoutes";
import personRoutes from "./routes/personRoutes";
import recordRoutes from "./routes/recordRoutes";
import accessRoutes from "./routes/accessRoutes";
import reportRoutes from "./routes/reportRoutes";
import externalRoutes from "./routes/externalRoutes";
import viewRoutes from "./routes/viewRoutes";

const app = express();

// View engine - EJS
app.set("view engine", "ejs");
app.set("views", path.resolve(process.cwd(), "src", "views"));

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve uploaded images
app.use("/img", express.static(path.resolve(config.upload.path)));

// Health check (public)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes (public — login/logout/create-user)
app.use("/auth", authRoutes);

// View (HTML) routes — auth protection is inside viewRoutes per-route
app.use("/", viewRoutes);

// Protected API Routes (JWT required)
app.use("/api", requireAuth, deviceRoutes);
app.use("/api", requireAuth, personRoutes);
app.use("/api", requireAuth, recordRoutes);
app.use("/api", requireAuth, accessRoutes);
app.use("/api/reports", requireAuth, reportRoutes);

// External API for HRMS (separate API key, no JWT)
app.use("/api/external", requireExternalApiKey, externalRoutes);

// Create HTTP server (needed for HRMS WebSocket upgrade)
const server = http.createServer(app);

// Set up HRMS real-time WebSocket on /ws/attendance
setupHrmsWebSocket(server);

// Start HTTP server
server.listen(config.http.port, () => {
  logger.info(`HTTP server started on port ${config.http.port}`);
});

// Start WebSocket server for device communication (port 7788, no auth)
startWebSocketServer();

// Start background command dispatcher job
startSendOrderJob();

logger.info("Attendance Management System started");
