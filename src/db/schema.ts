import {
  pgTable,
  serial,
  varchar,
  integer,
  text,
  timestamp,
  real,
  bigint,
  boolean,
} from "drizzle-orm/pg-core";

// ── Person (Employee/User) ──
export const persons = pgTable("persons", {
  id: serial("id").primaryKey(),           // terminal enroll ID (integer set by device)
  empId: varchar("emp_id", { length: 100 }), // external employee/student ID (mapped by user)
  name: varchar("name", { length: 255 }).notNull(),
  rollId: integer("roll_id").notNull().default(0), // privilege level
  alias: varchar("alias", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Enrollment Info (biometric data: fingerprint, face photo, card, password) ──
export const enrollInfos = pgTable("enroll_infos", {
  id: serial("id").primaryKey(),
  enrollId: integer("enroll_id").notNull(), // references person
  backupnum: integer("backupnum").notNull().default(50),
  // 0-9: fingerprint, 10: password, 11: card, 20-27: static face, 30-37: palm, 50: photo (base64)
  imagePath: varchar("image_path", { length: 512 }),
  signatures: text("signatures"), // base64 encoded biometric data
  name: varchar("name", { length: 255 }),
  admin: integer("admin").default(0), // 0: normal, 1: admin, 2: super user
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Device (Face Recognition Terminals) ──
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  serialNum: varchar("serial_num", { length: 100 }).notNull().unique(),
  status: integer("status").notNull().default(0), // 0: offline, 1: online
  modelName: varchar("model_name", { length: 100 }),
  firmware: varchar("firmware", { length: 100 }),
  macAddress: varchar("mac_address", { length: 50 }),
  userCapacity: integer("user_capacity"),
  fpCapacity: integer("fp_capacity"),
  logCapacity: integer("log_capacity"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Machine Command (Command Queue for async device communication) ──
export const machineCommands = pgTable("machine_commands", {
  id: serial("id").primaryKey(),
  serialNum: varchar("serial_num", { length: 100 }).notNull(), // device serial
  commandName: varchar("command_name", { length: 100 }).notNull(),
  content: text("content"), // JSON command payload
  status: integer("status").notNull().default(0), // 0: pending, 1: completed, 2: failed
  sendStatus: integer("send_status").notNull().default(0), // 0: unsent, 1: sent/awaiting response
  errCount: integer("err_count").notNull().default(0),
  runTime: timestamp("run_time"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Attendance Record ──
export const records = pgTable("records", {
  id: serial("id").primaryKey(),
  enrollId: bigint("enroll_id", { mode: "number" }).notNull(),
  recordTime: timestamp("record_time").notNull(),
  mode: integer("mode").default(0), // 0: fp, 1: card, 2: pwd, 8: face
  inOut: integer("in_out").default(0), // 0: in, 1: out
  event: integer("event").default(0),
  deviceSerialNum: varchar("device_serial_num", { length: 100 }),
  temperature: real("temperature"),
  image: varchar("image", { length: 512 }), // image file path
  verifyMode: integer("verify_mode"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Access Day (daily time zone sections) ──
export const accessDays = pgTable("access_days", {
  id: serial("id").primaryKey(),
  serialNum: varchar("serial_num", { length: 100 }).notNull(),
  zoneIndex: integer("zone_index").notNull(), // 0-7 (8 groups max)
  name: varchar("name", { length: 255 }),
  startTime1: varchar("start_time1", { length: 20 }).default("00:00"),
  endTime1: varchar("end_time1", { length: 20 }).default("00:00"),
  startTime2: varchar("start_time2", { length: 20 }).default("00:00"),
  endTime2: varchar("end_time2", { length: 20 }).default("00:00"),
  startTime3: varchar("start_time3", { length: 20 }).default("00:00"),
  endTime3: varchar("end_time3", { length: 20 }).default("00:00"),
  startTime4: varchar("start_time4", { length: 20 }).default("00:00"),
  endTime4: varchar("end_time4", { length: 20 }).default("00:00"),
  startTime5: varchar("start_time5", { length: 20 }).default("00:00"),
  endTime5: varchar("end_time5", { length: 20 }).default("00:00"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Access Week (weekly access rules mapping days to dayzones) ──
export const accessWeeks = pgTable("access_weeks", {
  id: serial("id").primaryKey(),
  serialNum: varchar("serial_num", { length: 100 }).notNull(),
  weekIndex: integer("week_index").notNull(), // 0-7 (8 groups max)
  name: varchar("name", { length: 255 }),
  monday: integer("monday").default(0),
  tuesday: integer("tuesday").default(0),
  wednesday: integer("wednesday").default(0),
  thursday: integer("thursday").default(0),
  friday: integer("friday").default(0),
  saturday: integer("saturday").default(0),
  sunday: integer("sunday").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Lock Group ──
export const lockGroups = pgTable("lock_groups", {
  id: serial("id").primaryKey(),
  serialNum: varchar("serial_num", { length: 100 }).notNull(),
  groupIndex: integer("group_index").notNull(), // 0-4 (5 groups max)
  groupValue: varchar("group_value", { length: 50 }), // e.g. "1234", "126"
  createdAt: timestamp("created_at").defaultNow(),
});

// ── User Lock (per-user access control parameters) ──
export const userLocks = pgTable("user_locks", {
  id: serial("id").primaryKey(),
  enrollId: integer("enroll_id").notNull(),
  serialNum: varchar("serial_num", { length: 100 }).notNull(),
  weekzone: integer("weekzone").default(0),
  weekzone2: integer("weekzone2").default(0),
  weekzone3: integer("weekzone3").default(0),
  weekzone4: integer("weekzone4").default(0),
  group: integer("group").default(0), // 0: no group, 1-9: group id
  startTime: varchar("start_time", { length: 30 }).default("2000-01-01 00:00:00"),
  endTime: varchar("end_time", { length: 30 }).default("2099-12-31 23:59:00"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── App Users (for UI authentication) ──
export const appUsers = pgTable("app_users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("user"), // "admin" | "user"
  createdAt: timestamp("created_at").defaultNow(),
});
