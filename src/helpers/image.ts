import fs from "fs";
import path from "path";
import { config } from "../config/index";

function ensureUploadDir() {
  if (!fs.existsSync(config.upload.path)) {
    fs.mkdirSync(config.upload.path, { recursive: true });
  }
}

export async function saveBase64Image(base64Data: string): Promise<string> {
  ensureUploadDir();
  const { v4: uuidv4 } = await import("uuid");
  const fileName = `${uuidv4()}.jpg`;
  const filePath = path.join(config.upload.path, fileName);
  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync(filePath, buffer);
  return fileName;
}

export function loadImageAsBase64(fileName: string): string | null {
  const filePath = path.join(config.upload.path, fileName);
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return buffer.toString("base64");
}

export function getCloudTime(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
