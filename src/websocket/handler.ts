import WebSocket from "ws";
import { db } from "../db/index";
import { devices, records, enrollInfos, machineCommands, persons } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { wsPool } from "./pool";
import { logger } from "../helpers/logger";
import { saveBase64Image, getCloudTime } from "../helpers/image";

export async function handleDeviceMessage(ws: WebSocket, rawMessage: string) {
  let data: any;
  try {
    data = JSON.parse(rawMessage);
  } catch {
    logger.error("Invalid JSON received", rawMessage);
    return;
  }

  // Device-initiated commands use "cmd", device responses use "ret"
  if (data.cmd) {
    await handleDeviceCommand(ws, data);
  } else if (data.ret) {
    await handleDeviceResponse(ws, data);
  }
}

// ── Handle commands initiated by the device ──
async function handleDeviceCommand(ws: WebSocket, data: any) {
  const cmd = data.cmd;

  switch (cmd) {
    case "reg":
      await handleRegister(ws, data);
      break;
    case "sendlog":
      await handleSendLog(ws, data);
      break;
    case "senduser":
      await handleSendUser(ws, data);
      break;
    case "sendqrcode":
      await handleSendQrCode(ws, data);
      break;
    default:
      logger.info(`Unknown device command: ${cmd}`);
  }
}

// ── Handle responses from device to server-initiated commands ──
async function handleDeviceResponse(ws: WebSocket, data: any) {
  const ret = data.ret;
  const sn = data.sn || "";

  logger.receive(sn, JSON.stringify(data));

  switch (ret) {
    case "getuserlist":
      await handleGetUserListResponse(ws, data);
      break;
    case "getuserinfo":
      await handleGetUserInfoResponse(data);
      break;
    case "setuserinfo":
    case "deleteuser":
    case "setusername":
    case "enableuser":
    case "cleanuser":
    case "setdevlock":
    case "setuserlock":
    case "deleteuserlock":
    case "cleanuserlock":
    case "setdevinfo":
    case "getdevinfo":
    case "opendoor":
    case "initsys":
    case "cleanadmin":
    case "cleanlog":
    case "settime":
    case "reboot":
    case "setquestionnaire":
    case "getquestionnaire":
    case "setholiday":
    case "getholiday":
    case "setuserprofile":
    case "getuserprofile":
      await markCommandCompleted(sn, ret, data.result);
      break;
    case "getnewlog":
    case "getalllog":
      await handleGetLogResponse(ws, data);
      break;
    case "getdevlock":
    case "getuserlock":
      await markCommandCompleted(sn, ret, data.result);
      break;
    default:
      logger.info(`Unknown device response: ${ret}`);
  }
}

// ── 1. Register ──
async function handleRegister(ws: WebSocket, data: any) {
  const sn = data.sn;
  if (!sn) {
    ws.send(JSON.stringify({ ret: "reg", result: false, reason: "missing sn" }));
    return;
  }

  logger.receive(sn, `Device registration: ${sn}`);

  // Upsert device in database
  const existing = await db.select().from(devices).where(eq(devices.serialNum, sn));
  if (existing.length === 0) {
    await db.insert(devices).values({
      serialNum: sn,
      status: 1,
      modelName: data.devinfo?.modelname || null,
      firmware: data.devinfo?.firmware || null,
      macAddress: data.devinfo?.mac || null,
      userCapacity: data.devinfo?.usersize || null,
      fpCapacity: data.devinfo?.fpsize || null,
      logCapacity: data.devinfo?.logsize || null,
    });
  } else {
    await db
      .update(devices)
      .set({
        status: 1,
        modelName: data.devinfo?.modelname || existing[0].modelName,
        firmware: data.devinfo?.firmware || existing[0].firmware,
        updatedAt: new Date(),
      })
      .where(eq(devices.serialNum, sn));
  }

  // Add to WebSocket pool
  wsPool.addDevice(sn, ws);

  ws.send(
    JSON.stringify({
      ret: "reg",
      result: true,
      cloudtime: getCloudTime(),
      nosenduser: true,
    })
  );

  logger.send(sn, "Registration successful");
}

// ── 2. Send Log (attendance record from device) ──
async function handleSendLog(ws: WebSocket, data: any) {
  const sn = data.sn || "";
  const recordList = data.record || [];
  const logindex = data.logindex || 0;
  const count = data.count || recordList.length;

  logger.receive(sn, `Attendance records received: ${count}`);

  for (const rec of recordList) {
    let imagePath: string | null = null;
    if (rec.image) {
      try {
        imagePath = await saveBase64Image(rec.image);
      } catch (e: any) {
        logger.error("Failed to save attendance image", e.message);
      }
    }

    await db.insert(records).values({
      enrollId: rec.enrollid || 0,
      recordTime: new Date(rec.time),
      mode: rec.mode ?? 0,
      inOut: rec.inout ?? 0,
      event: rec.event ?? 0,
      deviceSerialNum: sn,
      temperature: rec.temp ? Math.round((rec.temp / 10) * 10) / 10 : null,
      image: imagePath,
      verifyMode: rec.verifymode ?? null,
    });
  }

  ws.send(
    JSON.stringify({
      ret: "sendlog",
      result: true,
      count,
      logindex,
      cloudtime: getCloudTime(),
    })
  );
}

// ── 3. Send User (enrollment data from device) ──
async function handleSendUser(ws: WebSocket, data: any) {
  const sn = data.sn || "";
  const enrollId = data.enrollid;
  const backupnum = data.backupnum;
  const name = data.name || "";
  const admin = data.admin || 0;
  const record = data.record || "";

  logger.receive(sn, `User enrollment data: enrollId=${enrollId}, backupnum=${backupnum}`);

  let imagePath: string | null = null;
  let signatures: string | null = null;

  if (backupnum === 50 && record) {
    // Photo - save as image file
    try {
      imagePath = await saveBase64Image(record);
    } catch (e: any) {
      logger.error("Failed to save user photo", e.message);
    }
    signatures = record;
  } else {
    signatures = typeof record === "string" ? record : String(record);
  }

  // Upsert enrollment info
  const existing = await db
    .select()
    .from(enrollInfos)
    .where(and(eq(enrollInfos.enrollId, enrollId), eq(enrollInfos.backupnum, backupnum)));

  if (existing.length > 0) {
    await db
      .update(enrollInfos)
      .set({
        signatures,
        imagePath,
        name,
        admin,
        updatedAt: new Date(),
      })
      .where(and(eq(enrollInfos.enrollId, enrollId), eq(enrollInfos.backupnum, backupnum)));
  } else {
    await db.insert(enrollInfos).values({
      enrollId,
      backupnum,
      signatures,
      imagePath,
      name,
      admin,
    });
  }

  ws.send(
    JSON.stringify({
      ret: "senduser",
      result: true,
      cloudtime: getCloudTime(),
    })
  );
}

// ── QR Code handler ──
async function handleSendQrCode(ws: WebSocket, data: any) {
  const sn = data.sn || "";
  const qrRecord = data.record || "";

  logger.receive(sn, `QR code received: ${qrRecord}`);

  // Default: allow access. Extend this with custom QR validation logic.
  ws.send(
    JSON.stringify({
      ret: "sendqrcode",
      sn,
      result: true,
      access: 1,
      enrollid: 0,
      username: "",
      message: "ok",
      voice: "ok",
    })
  );
}

// ── Handle getuserlist paginated response ──
async function handleGetUserListResponse(ws: WebSocket, data: any) {
  const sn = data.sn || "";
  const count = data.count || 0;
  const recordList = data.record || [];

  logger.receive(sn, `User list received: count=${count}`);

  // Save each user to persons + enrollInfos tables AND queue getuserinfo to fetch full data
  for (const rec of recordList) {
    const enrollId = rec.enrollid;
    const adminVal = parseInt(rec.admin) || 0;
    const backupnum = rec.backupnum;

    if (!enrollId) continue;

    // Upsert into persons table
    const existingPerson = await db.select().from(persons).where(eq(persons.id, enrollId));
    if (existingPerson.length === 0) {
      await db.insert(persons).values({
        id: enrollId,
        name: `User_${enrollId}`, // placeholder name until getuserinfo returns real name
        rollId: adminVal,
      });
    }

    // Upsert into enrollInfos table (basic record, full data comes from getuserinfo)
    const existingEnroll = await db
      .select()
      .from(enrollInfos)
      .where(and(eq(enrollInfos.enrollId, enrollId), eq(enrollInfos.backupnum, backupnum)));

    if (existingEnroll.length === 0) {
      await db.insert(enrollInfos).values({
        enrollId,
        backupnum,
        admin: adminVal,
        name: `User_${enrollId}`,
      });
    }

    // Auto-queue getuserinfo command to fetch full data (photo/fingerprint/card/password)
    const payload = {
      cmd: "getuserinfo",
      sn,
      enrollid: enrollId,
      backupnum,
    };

    await db.insert(machineCommands).values({
      serialNum: sn,
      commandName: "getuserinfo",
      content: JSON.stringify(payload),
    });

    logger.info(`Queued getuserinfo for enrollId=${enrollId}, backupnum=${backupnum}`);
  }

  // If there are more records, request next page
  if (count > 0 && recordList.length > 0) {
    ws.send(JSON.stringify({ cmd: "getuserlist", stn: false }));
  }

  await markCommandCompleted(sn, "getuserlist", data.result);
}

// ── Handle getuserinfo response (save enrollment data) ──
async function handleGetUserInfoResponse(data: any) {
  const sn = data.sn || "";
  const enrollId = data.enrollid;
  const backupnum = data.backupnum;
  const record = data.record || "";
  const name = data.name || "";
  const admin = parseInt(data.admin) || 0;

  if (!data.result) {
    logger.error(`getuserinfo failed for enrollId=${enrollId}, backupnum=${backupnum}`);
    await markCommandCompleted(sn, "getuserinfo", false);
    return;
  }

  logger.info(`getuserinfo received: enrollId=${enrollId}, backupnum=${backupnum}, name=${name}`);

  let imagePath: string | null = null;
  let signatures: string | null = null;

  if (backupnum === 50 && record) {
    // Photo (Base64) — save as image file
    try {
      imagePath = await saveBase64Image(record);
    } catch (e: any) {
      logger.error("Failed to save fetched user photo", e.message);
    }
    signatures = record;
  } else {
    signatures = typeof record === "string" ? record : String(record);
  }

  // Upsert enrollment info
  const existing = await db
    .select()
    .from(enrollInfos)
    .where(and(eq(enrollInfos.enrollId, enrollId), eq(enrollInfos.backupnum, backupnum)));

  if (existing.length > 0) {
    await db
      .update(enrollInfos)
      .set({
        signatures,
        imagePath: imagePath || existing[0].imagePath,
        name: name || existing[0].name,
        admin,
        updatedAt: new Date(),
      })
      .where(and(eq(enrollInfos.enrollId, enrollId), eq(enrollInfos.backupnum, backupnum)));
  } else {
    await db.insert(enrollInfos).values({
      enrollId,
      backupnum,
      signatures,
      imagePath,
      name,
      admin,
    });
  }

  // Also update the person's name if we got a real name from the device
  if (name) {
    const existingPerson = await db.select().from(persons).where(eq(persons.id, enrollId));
    if (existingPerson.length > 0) {
      await db
        .update(persons)
        .set({ name, rollId: admin, updatedAt: new Date() })
        .where(eq(persons.id, enrollId));
    } else {
      await db.insert(persons).values({
        id: enrollId,
        name,
        rollId: admin,
      });
    }
  }

  await markCommandCompleted(sn, "getuserinfo", true);
}

// ── Handle getalllog / getnewlog paginated response ──
async function handleGetLogResponse(ws: WebSocket, data: any) {
  const sn = data.sn || "";
  const ret = data.ret;
  const count = data.count || 0;
  const recordList = data.record || [];

  for (const rec of recordList) {
    await db.insert(records).values({
      enrollId: rec.enrollid || 0,
      recordTime: new Date(rec.time),
      mode: rec.mode ?? 0,
      inOut: rec.inout ?? 0,
      event: rec.event ?? 0,
      deviceSerialNum: sn,
      temperature: rec.temp ? Math.round((rec.temp / 10) * 10) / 10 : null,
      image: null,
      verifyMode: rec.verifymode ?? null,
    });
  }

  // If more pages, request next
  if (count > 0 && recordList.length > 0) {
    ws.send(JSON.stringify({ cmd: ret === "getalllog" ? "getalllog" : "getnewlog", stn: false }));
  }

  await markCommandCompleted(sn, ret, data.result);
}

// ── Mark a machine command as completed ──
async function markCommandCompleted(serialNum: string, commandName: string, result: boolean) {
  const pending = await db
    .select()
    .from(machineCommands)
    .where(
      and(
        eq(machineCommands.serialNum, serialNum),
        eq(machineCommands.commandName, commandName),
        eq(machineCommands.sendStatus, 1)
      )
    );

  if (pending.length > 0) {
    await db
      .update(machineCommands)
      .set({
        status: result ? 1 : 2,
        sendStatus: 0,
        updatedAt: new Date(),
      })
      .where(eq(machineCommands.id, pending[0].id));
  }
}
