import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve("logs");

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFile(): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `log${date}.log`);
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function writeLog(level: string, message: string, extra?: string) {
  ensureLogDir();
  const line = `[${formatTimestamp()}] [${level}] ${message}${extra ? " | " + extra : ""}\n`;
  console.log(line.trim());
  fs.appendFileSync(getLogFile(), line);
}

export const logger = {
  info(message: string, extra?: string) {
    writeLog("INFO", message, extra);
  },
  error(message: string, extra?: string) {
    writeLog("ERROR", message, extra);
  },
  send(deviceSn: string, message: string) {
    writeLog("SEND", `[${deviceSn}] ${message}`);
  },
  receive(deviceSn: string, message: string) {
    writeLog("RECV", `[${deviceSn}] ${message}`);
  },
};
