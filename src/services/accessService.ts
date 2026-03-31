import { db } from "../db/index";
import {
  accessDays,
  accessWeeks,
  lockGroups,
  userLocks,
  machineCommands,
  devices,
} from "../db/schema";
import { eq, and } from "drizzle-orm";

interface DayZoneInput {
  zoneIndex: number;
  sections: string[]; // e.g. ["06:00~18:00", "19:00~21:00"]
}

interface WeekZoneInput {
  weekIndex: number;
  days: number[]; // 7 values (mon-sun), each referencing a dayzone index
}

interface LockGroupInput {
  groupIndex: number;
  groupValue: string; // e.g. "1234"
}

interface UserLockInput {
  enrollId: number;
  weekzone?: number;
  weekzone2?: number;
  weekzone3?: number;
  weekzone4?: number;
  group?: number;
  startTime?: string;
  endTime?: string;
}

// ── Set Access Day zones for a device ──
export async function setAccessDay(deviceSn: string, dayZones: DayZoneInput[]) {
  for (const dz of dayZones) {
    const sections = dz.sections;
    const values: any = {
      serialNum: deviceSn,
      zoneIndex: dz.zoneIndex,
      startTime1: sections[0]?.split("~")[0] || "00:00",
      endTime1: sections[0]?.split("~")[1] || "00:00",
      startTime2: sections[1]?.split("~")[0] || "00:00",
      endTime2: sections[1]?.split("~")[1] || "00:00",
      startTime3: sections[2]?.split("~")[0] || "00:00",
      endTime3: sections[2]?.split("~")[1] || "00:00",
      startTime4: sections[3]?.split("~")[0] || "00:00",
      endTime4: sections[3]?.split("~")[1] || "00:00",
      startTime5: sections[4]?.split("~")[0] || "00:00",
      endTime5: sections[4]?.split("~")[1] || "00:00",
    };

    const existing = await db
      .select()
      .from(accessDays)
      .where(and(eq(accessDays.serialNum, deviceSn), eq(accessDays.zoneIndex, dz.zoneIndex)));

    if (existing.length > 0) {
      await db
        .update(accessDays)
        .set(values)
        .where(eq(accessDays.id, existing[0].id));
    } else {
      await db.insert(accessDays).values(values);
    }
  }
}

// ── Set Access Week zones for a device ──
export async function setAccessWeek(deviceSn: string, weekZones: WeekZoneInput[]) {
  for (const wz of weekZones) {
    const values: any = {
      serialNum: deviceSn,
      weekIndex: wz.weekIndex,
      monday: wz.days[0] ?? 0,
      tuesday: wz.days[1] ?? 0,
      wednesday: wz.days[2] ?? 0,
      thursday: wz.days[3] ?? 0,
      friday: wz.days[4] ?? 0,
      saturday: wz.days[5] ?? 0,
      sunday: wz.days[6] ?? 0,
    };

    const existing = await db
      .select()
      .from(accessWeeks)
      .where(and(eq(accessWeeks.serialNum, deviceSn), eq(accessWeeks.weekIndex, wz.weekIndex)));

    if (existing.length > 0) {
      await db
        .update(accessWeeks)
        .set(values)
        .where(eq(accessWeeks.id, existing[0].id));
    } else {
      await db.insert(accessWeeks).values(values);
    }
  }
}

// ── Set Lock Groups for a device ──
export async function setLockGroup(deviceSn: string, groups: LockGroupInput[]) {
  for (const g of groups) {
    const existing = await db
      .select()
      .from(lockGroups)
      .where(and(eq(lockGroups.serialNum, deviceSn), eq(lockGroups.groupIndex, g.groupIndex)));

    if (existing.length > 0) {
      await db
        .update(lockGroups)
        .set({ groupValue: g.groupValue })
        .where(eq(lockGroups.id, existing[0].id));
    } else {
      await db.insert(lockGroups).values({
        serialNum: deviceSn,
        groupIndex: g.groupIndex,
        groupValue: g.groupValue,
      });
    }
  }
}

// ── Build and send setdevlock command to all devices ──
export async function pushAccessConfigToAllDevices(
  dayZones: DayZoneInput[],
  weekZones: WeekZoneInput[],
  groups: LockGroupInput[]
) {
  // Build the protocol payload
  const dayzonePayload = dayZones.map((dz) => ({
    day: dz.sections.map((s) => ({ section: s })),
  }));

  const weekzonePayload = weekZones.map((wz) => ({
    week: wz.days.map((d) => ({ day: d })),
  }));

  const lockgroupPayload = groups.map((g) => ({ group: parseInt(g.groupValue) || 0 }));

  const payload: any = { cmd: "setdevlock" };
  if (dayzonePayload.length > 0) payload.dayzone = dayzonePayload;
  if (weekzonePayload.length > 0) payload.weekzone = weekzonePayload;
  if (lockgroupPayload.length > 0) payload.lockgroup = lockgroupPayload;

  const allDevices = await db.select().from(devices);
  for (const device of allDevices) {
    await setAccessDay(device.serialNum, dayZones);
    await setAccessWeek(device.serialNum, weekZones);
    await setLockGroup(device.serialNum, groups);

    await db.insert(machineCommands).values({
      serialNum: device.serialNum,
      commandName: "setdevlock",
      content: JSON.stringify(payload),
    });
  }
}

// ── Set User Lock (per-user access control) ──
export async function setUserLock(deviceSn: string, userLockInputs: UserLockInput[]) {
  const records: any[] = [];

  for (const ul of userLockInputs) {
    // Save to DB
    const existing = await db
      .select()
      .from(userLocks)
      .where(and(eq(userLocks.enrollId, ul.enrollId), eq(userLocks.serialNum, deviceSn)));

    const values = {
      enrollId: ul.enrollId,
      serialNum: deviceSn,
      weekzone: ul.weekzone ?? 0,
      weekzone2: ul.weekzone2 ?? 0,
      weekzone3: ul.weekzone3 ?? 0,
      weekzone4: ul.weekzone4 ?? 0,
      group: ul.group ?? 0,
      startTime: ul.startTime || "2000-01-01 00:00:00",
      endTime: ul.endTime || "2099-12-31 23:59:00",
    };

    if (existing.length > 0) {
      await db.update(userLocks).set(values).where(eq(userLocks.id, existing[0].id));
    } else {
      await db.insert(userLocks).values(values);
    }

    records.push({
      enrollid: ul.enrollId,
      weekzone: ul.weekzone ?? 0,
      weekzone2: ul.weekzone2 ?? 0,
      weekzone3: ul.weekzone3 ?? 0,
      weekzone4: ul.weekzone4 ?? 0,
      group: ul.group ?? 0,
      starttime: ul.startTime || "2000-01-01 00:00:00",
      endtime: ul.endTime || "2099-12-31 23:59:00",
    });
  }

  // Create command
  const payload = {
    cmd: "setuserlock",
    count: records.length,
    record: records,
  };

  await db.insert(machineCommands).values({
    serialNum: deviceSn,
    commandName: "setuserlock",
    content: JSON.stringify(payload),
  });
}
