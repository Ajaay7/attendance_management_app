import { db } from "../db/index";
import { machineCommands } from "../db/schema";
import { eq, and, lt } from "drizzle-orm";
import { wsPool } from "../websocket/pool";
import { logger } from "../helpers/logger";

const MAX_RETRIES = 3;
const RESPONSE_TIMEOUT_MS = 20_000; // 20 seconds
const POLL_INTERVAL_MS = 1_000; // 1 second

let running = false;

export function startSendOrderJob() {
  running = true;
  logger.info("SendOrderJob started");
  tick();
}

export function stopSendOrderJob() {
  running = false;
  logger.info("SendOrderJob stopped");
}

async function tick() {
  if (!running) return;

  try {
    await processCommands();
  } catch (err: any) {
    logger.error("SendOrderJob error", err.message);
  }

  setTimeout(tick, POLL_INTERVAL_MS);
}

async function processCommands() {
  // 1. Check for timed-out commands (sendStatus=1 for too long)
  await handleTimedOutCommands();

  // 2. Find pending unsent commands (status=0, sendStatus=0)
  const pending = await db
    .select()
    .from(machineCommands)
    .where(
      and(
        eq(machineCommands.status, 0),
        eq(machineCommands.sendStatus, 0),
        lt(machineCommands.errCount, MAX_RETRIES)
      )
    );

  for (const cmd of pending) {
    const sn = cmd.serialNum;

    if (!wsPool.isOnline(sn)) {
      continue; // Device offline, skip
    }

    let payload: any;
    try {
      payload = cmd.content ? JSON.parse(cmd.content) : {};
    } catch {
      logger.error(`Invalid command JSON for id=${cmd.id}`, cmd.content || "");
      await db
        .update(machineCommands)
        .set({ status: 2, updatedAt: new Date() })
        .where(eq(machineCommands.id, cmd.id));
      continue;
    }

    // Send command to device
    const sent = wsPool.sendMessage(sn, payload);

    if (sent) {
      logger.send(sn, `Command sent: ${cmd.commandName} (id=${cmd.id})`);
      await db
        .update(machineCommands)
        .set({
          sendStatus: 1,
          runTime: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(machineCommands.id, cmd.id));
    } else {
      logger.error(`Failed to send to ${sn}`, `command=${cmd.commandName}`);
      await db
        .update(machineCommands)
        .set({
          errCount: (cmd.errCount || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(machineCommands.id, cmd.id));
    }

    // Process one command at a time per cycle (same as Flask app)
    break;
  }
}

async function handleTimedOutCommands() {
  const awaiting = await db
    .select()
    .from(machineCommands)
    .where(
      and(
        eq(machineCommands.status, 0),
        eq(machineCommands.sendStatus, 1)
      )
    );

  const now = Date.now();
  for (const cmd of awaiting) {
    if (cmd.runTime && now - cmd.runTime.getTime() > RESPONSE_TIMEOUT_MS) {
      const newErrCount = (cmd.errCount || 0) + 1;
      if (newErrCount >= MAX_RETRIES) {
        // Mark as failed
        await db
          .update(machineCommands)
          .set({
            status: 2,
            sendStatus: 0,
            errCount: newErrCount,
            updatedAt: new Date(),
          })
          .where(eq(machineCommands.id, cmd.id));
        logger.error(`Command timed out and failed: id=${cmd.id}`, cmd.commandName);
      } else {
        // Reset for retry
        await db
          .update(machineCommands)
          .set({
            sendStatus: 0,
            errCount: newErrCount,
            updatedAt: new Date(),
          })
          .where(eq(machineCommands.id, cmd.id));
        logger.info(`Command timed out, retrying: id=${cmd.id} (attempt ${newErrCount})`);
      }
    }
  }
}
