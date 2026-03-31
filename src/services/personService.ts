import { db } from "../db/index";
import { persons, enrollInfos, machineCommands, devices } from "../db/schema";
import { eq } from "drizzle-orm";
import { loadImageAsBase64 } from "../helpers/image";

// Create a command to push user enrollment data to a specific device
export async function setUserToDevice(deviceSn: string, enrollId: number) {
  const enrollments = await db
    .select()
    .from(enrollInfos)
    .where(eq(enrollInfos.enrollId, enrollId));

  for (const enroll of enrollments) {
    let record: any = enroll.signatures || "";

    // For photos, load from file if no base64 in signatures
    if (enroll.backupnum === 50 && enroll.imagePath && !record) {
      const base64 = loadImageAsBase64(enroll.imagePath);
      if (base64) record = base64;
    }

    const payload = {
      cmd: "setuserinfo",
      enrollid: enroll.enrollId,
      name: enroll.name || "",
      backupnum: enroll.backupnum,
      admin: enroll.admin || 0,
      record,
    };

    await db.insert(machineCommands).values({
      serialNum: deviceSn,
      commandName: "setuserinfo",
      content: JSON.stringify(payload),
    });
  }
}

// Push ALL users to a specific device
export async function setAllUsersToDevice(deviceSn: string) {
  const allEnrollments = await db.select().from(enrollInfos);

  for (const enroll of allEnrollments) {
    let record: any = enroll.signatures || "";
    if (enroll.backupnum === 50 && enroll.imagePath && !record) {
      const base64 = loadImageAsBase64(enroll.imagePath);
      if (base64) record = base64;
    }

    const payload = {
      cmd: "setuserinfo",
      enrollid: enroll.enrollId,
      name: enroll.name || "",
      backupnum: enroll.backupnum,
      admin: enroll.admin || 0,
      record,
    };

    await db.insert(machineCommands).values({
      serialNum: deviceSn,
      commandName: "setuserinfo",
      content: JSON.stringify(payload),
    });
  }
}

// Push usernames to device (batch, max 50 per command)
export async function setUsernameToDevice(deviceSn: string) {
  const allPersons = await db.select().from(persons);

  const BATCH_SIZE = 50;
  for (let i = 0; i < allPersons.length; i += BATCH_SIZE) {
    const batch = allPersons.slice(i, i + BATCH_SIZE);
    const payload = {
      cmd: "setusername",
      count: batch.length,
      record: batch.map((p) => ({
        enrollid: p.id,
        name: p.name,
      })),
    };

    await db.insert(machineCommands).values({
      serialNum: deviceSn,
      commandName: "setusername",
      content: JSON.stringify(payload),
    });
  }
}

// Delete user from device
export async function deleteUserFromDevice(deviceSn: string, enrollId: number, backupnum: number = 13) {
  const payload = {
    cmd: "deleteuser",
    enrollid: enrollId,
    backupnum,
  };

  await db.insert(machineCommands).values({
    serialNum: deviceSn,
    commandName: "deleteuser",
    content: JSON.stringify(payload),
  });
}

// Request user info from device
export async function getUserInfoFromDevice(deviceSn: string, enrollId: number, backupnum: number = 50) {
  const payload = {
    cmd: "getuserinfo",
    sn: deviceSn,
    enrollid: enrollId,
    backupnum,
  };

  await db.insert(machineCommands).values({
    serialNum: deviceSn,
    commandName: "getuserinfo",
    content: JSON.stringify(payload),
  });
}

// Push all users to ALL online devices
export async function setAllUsersToAllDevices() {
  const allDevices = await db.select().from(devices);
  for (const device of allDevices) {
    await setAllUsersToDevice(device.serialNum);
  }
}
