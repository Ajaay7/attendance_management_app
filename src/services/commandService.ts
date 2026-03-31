import { db } from "../db/index";
import { machineCommands, devices } from "../db/schema";

// Helper to create a simple command for a device
export async function createCommand(
  deviceSn: string,
  commandName: string,
  payload: object
) {
  await db.insert(machineCommands).values({
    serialNum: deviceSn,
    commandName,
    content: JSON.stringify(payload),
  });
}

// Create a command for ALL devices
export async function createCommandForAllDevices(commandName: string, payload: object) {
  const allDevices = await db.select().from(devices);
  for (const device of allDevices) {
    await createCommand(device.serialNum, commandName, payload);
  }
}

// ── Convenience methods for common device commands ──

export async function getDeviceInfo(deviceSn: string) {
  await createCommand(deviceSn, "getdevinfo", { cmd: "getdevinfo" });
}

export async function getUserList(deviceSn: string) {
  await createCommand(deviceSn, "getuserlist", { cmd: "getuserlist", stn: true });
}

export async function getAllLog(deviceSn: string) {
  await createCommand(deviceSn, "getalllog", { cmd: "getalllog", stn: true });
}

export async function getNewLog(deviceSn: string) {
  await createCommand(deviceSn, "getnewlog", { cmd: "getnewlog", stn: true });
}

export async function openDoor(deviceSn: string, doorNum?: number) {
  const payload: any = { cmd: "opendoor" };
  if (doorNum !== undefined) payload.doornum = doorNum;
  await createCommand(deviceSn, "opendoor", payload);
}

export async function initSystem(deviceSn: string) {
  await createCommand(deviceSn, "initsys", { cmd: "initsys" });
}

export async function rebootDevice(deviceSn: string) {
  await createCommand(deviceSn, "reboot", { cmd: "reboot" });
}

export async function cleanAdmin(deviceSn: string) {
  await createCommand(deviceSn, "cleanadmin", { cmd: "cleanadmin" });
}

export async function cleanLog(deviceSn: string) {
  await createCommand(deviceSn, "cleanlog", { cmd: "cleanlog" });
}

export async function cleanUser(deviceSn: string) {
  await createCommand(deviceSn, "cleanuser", { cmd: "cleanuser" });
}

export async function setTime(deviceSn: string, cloudtime: string) {
  await createCommand(deviceSn, "settime", { cmd: "settime", cloudtime });
}

export async function enableUser(deviceSn: string, enrollId: number, enable: boolean) {
  await createCommand(deviceSn, "enableuser", {
    cmd: "enableuser",
    enrollid: enrollId,
    enflag: enable ? 1 : 0,
  });
}

export async function getDevLock(deviceSn: string) {
  await createCommand(deviceSn, "getdevlock", { cmd: "getdevlock" });
}

export async function getUserLock(deviceSn: string, enrollId: number) {
  await createCommand(deviceSn, "getuserlock", { cmd: "getuserlock", enrollid: enrollId });
}

export async function deleteUserLock(deviceSn: string, enrollId: number) {
  await createCommand(deviceSn, "deleteuserlock", { cmd: "deleteuserlock", enrollid: enrollId });
}

export async function cleanUserLock(deviceSn: string) {
  await createCommand(deviceSn, "cleanuserlock", { cmd: "cleanuserlock" });
}

export async function setDeviceInfo(deviceSn: string, settings: object) {
  await createCommand(deviceSn, "setdevinfo", { cmd: "setdevinfo", ...settings });
}

export async function setHoliday(deviceSn: string, holidays: any[]) {
  await createCommand(deviceSn, "setholiday", { cmd: "setholiday", holidays });
}

export async function getHoliday(deviceSn: string) {
  await createCommand(deviceSn, "getholiday", { cmd: "getholiday", stn: true });
}

export async function setQuestionnaire(deviceSn: string, params: object) {
  await createCommand(deviceSn, "setquestionnaire", { cmd: "setquestionnaire", ...params });
}

export async function getQuestionnaire(deviceSn: string) {
  await createCommand(deviceSn, "getquestionnaire", { cmd: "getquestionnaire", stn: true });
}

export async function setUserProfile(deviceSn: string, enrollId: number, profile: string) {
  await createCommand(deviceSn, "setuserprofile", { cmd: "setuserprofile", enrollid: enrollId, profile });
}

export async function getUserProfile(deviceSn: string, enrollId: number) {
  await createCommand(deviceSn, "getuserprofile", { cmd: "getuserprofile", enrollid: enrollId });
}
