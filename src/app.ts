import express from "express";
import cors from "cors";
import path from "path";
import { config } from "./config/index";
import { logger } from "./helpers/logger";
import { startWebSocketServer } from "./websocket/server";
import { startSendOrderJob } from "./jobs/sendOrderJob";

// Routes
import deviceRoutes from "./routes/deviceRoutes";
import personRoutes from "./routes/personRoutes";
import recordRoutes from "./routes/recordRoutes";
import accessRoutes from "./routes/accessRoutes";
import viewRoutes from "./routes/viewRoutes";

const app = express();

// View engine - EJS
app.set("view engine", "ejs");
// Resolve views from project root (works for both tsx dev and tsc compiled dist/)
//new
app.set("views", path.resolve(process.cwd(),"src", "views"));

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve uploaded images
app.use("/img", express.static(path.resolve(config.upload.path)));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// View (HTML) Routes
app.use("/", viewRoutes);

// API Routes
app.use("/api", deviceRoutes);
app.use("/api", personRoutes);
app.use("/api", recordRoutes);
app.use("/api", accessRoutes);

// Start HTTP server
app.listen(config.http.port, () => {
  logger.info(`HTTP server started on port ${config.http.port}`);
});

// Start WebSocket server for device communication (port 7788)
startWebSocketServer();

// Start background command dispatcher job
startSendOrderJob();

logger.info("Attendance Management System started");
