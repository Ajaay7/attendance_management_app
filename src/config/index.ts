import "dotenv/config";

export const config = {
  database: {
    url: process.env.DATABASE_URL || "postgres://postgres:tasmac@3.111.75.24:5432/attendance_db",
  },
  http: {
    port: parseInt(process.env.HTTP_PORT || "5000", 10),
  },
  websocket: {
    port: parseInt(process.env.WEBSOCKET_PORT || "7788", 10),
  },
  upload: {
    path: process.env.UPLOAD_PATH || "./uploads/pictures",
  },
};
