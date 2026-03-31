# Attendance Management System (AMS)

A **Node.js + Express** application for managing AI face recognition attendance devices (like AI-06, AI-08 | TM-AI08 Dynamic Face Recognition Terminal).

Communicates with biometric terminals over WebSocket (RFC 6455) to handle user enrollment, attendance logging, access control, and device management in real time.

---

## Features

- **Real-time device communication** via WebSocket (port 7788) using the cloud solution JSON protocol
- **Attendance logging** &mdash; face, fingerprint, card, password, and QR code verification
- **User enrollment management** &mdash; push/pull face photos (Base64), fingerprints, cards, passwords to devices
- **Access control** &mdash; daily time zones, weekly schedules, lock groups, per-user access rules
- **Async command queue** &mdash; reliable command dispatch with retry logic (3 attempts, 20s timeout)
- **Batch operations** &mdash; bulk upload/delete users via Excel (.xlsx)
- **Web dashboard** &mdash; Bootstrap 5 UI for staff management & attendance logs
- **Device management** &mdash; registration, info, reboot, door control, init system

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express 5 |
| WebSocket | ws |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Template Engine | EJS |
| Language | TypeScript |
| Excel Handling | ExcelJS |

## Supported Device Commands

| Command | Description |
|---------|-------------|
| `reg` | Device registration |
| `sendlog` | Receive attendance records |
| `senduser` | Receive user enrollment data |
| `setuserinfo` | Push user data to device |
| `getuserlist` | Get user list from device |
| `getuserinfo` | Get specific user enrollment info |
| `deleteuser` | Delete user from device |
| `setusername` | Batch push usernames |
| `enableuser` | Enable/disable user |
| `getnewlog` / `getalllog` | Fetch attendance logs |
| `setdevlock` | Set access control parameters (day zones, week zones, lock groups) |
| `setuserlock` / `getuserlock` | Per-user access restrictions |
| `opendoor` | Remote door open (supports 1-4 doors) |
| `getdevinfo` / `setdevinfo` | Device configuration |
| `settime` | Sync device clock |
| `initsys` | Factory reset (clears users & logs) |
| `reboot` | Restart device |
| `cleanadmin` | Reset all admins to normal users |
| `setholiday` / `getholiday` | Holiday schedule management |
| `setquestionnaire` / `getquestionnaire` | Questionnaire configuration |
| `sendqrcode` | QR code verification |

---

## Project Structure

```
src/
├── app.ts                        # Entry point - Express + WebSocket startup
├── config/
│   └── index.ts                  # Environment configuration
├── db/
│   ├── client.ts                 # PostgreSQL connection pool (pg)
│   ├── index.ts                  # Drizzle ORM instance
│   └── schema.ts                 # Database schema (9 tables)
├── websocket/
│   ├── server.ts                 # WebSocket server (port 7788)
│   ├── handler.ts                # Protocol message handler
│   └── pool.ts                   # Device connection pool
├── jobs/
│   └── sendOrderJob.ts           # Background command dispatcher
├── services/
│   ├── personService.ts          # User enrollment operations
│   ├── accessService.ts          # Access control configuration
│   └── commandService.ts         # Device command helpers (20+ commands)
├── routes/
│   ├── viewRoutes.ts             # HTML page routes
│   ├── deviceRoutes.ts           # Device management API
│   ├── personRoutes.ts           # User management API
│   ├── recordRoutes.ts           # Attendance records API
│   └── accessRoutes.ts           # Access control API
├── helpers/
│   ├── logger.ts                 # File + console logging
│   └── image.ts                  # Base64 image utilities
└── views/
    ├── index.ejs                 # Staff list dashboard
    ├── logRecords.ejs            # Attendance log records
    └── partials/
        ├── head.ejs              # Common head (Bootstrap 5, icons, styles)
        ├── navbar.ejs            # Navigation bar with device selector
        └── scripts.ejs           # Shared JS (device loader, API helpers)
```

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **PostgreSQL** database
- Compatible face recognition terminals (AI-06, AI-08, TM-AI08, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/attendance-node-app.git
cd attendance-node-app

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Configuration

Edit `.env` with your settings:

```env
DATABASE_URL=postgres://username:password@localhost:5432/attendance_db
HTTP_PORT=3000
WEBSOCKET_PORT=7788
UPLOAD_PATH=./uploads/pictures
```

> **Note:** On macOS, port 5000 is used by AirPlay Receiver. Use port 3000 or disable AirPlay in System Settings.

### Database Setup

```bash
# Push schema directly to database (recommended for development)
npm run db:push

# Or generate and run migrations
npm run db:generate
npm run db:migrate
```

### Run

```bash
# Development (hot reload)
npm run dev

# Production
npm run start
```

### Access

| Service | URL |
|---------|-----|
| Web Dashboard | `http://localhost:3000` |
| Log Records | `http://localhost:3000/logRecords` |
| API Base | `http://localhost:3000/api/*` |
| WebSocket (devices) | `ws://YOUR_SERVER_IP:7788` |
| Health Check | `http://localhost:3000/health` |

---

## Database Schema

```
persons          - Employee/user profiles
enrollInfos      - Biometric data (face photos, fingerprints, cards, passwords)
devices          - Registered face recognition terminals
machineCommands  - Async command queue for device communication
records          - Attendance log entries
accessDays       - Daily time zone definitions (8 zones, 5 slots each)
accessWeeks      - Weekly access schedules (maps days to zones)
lockGroups       - Multi-person door access groups
userLocks        - Per-user access control parameters
```

## API Endpoints

### Device Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/device` | Register a new device |
| GET | `/api/device` | List all devices (with online status) |
| GET | `/api/getDeviceInfo` | Request device info |
| GET | `/api/openDoor` | Open door remotely |
| GET | `/api/initSystem` | Initialize/reset device |
| GET | `/api/reboot` | Reboot device |
| GET | `/api/cleanAdmin` | Reset admin users |
| GET | `/api/getDevLock` | Get device access lock config |

### User Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/addPerson` | Add person (with photo upload) |
| POST | `/api/uploadPerson` | Batch upload from Excel |
| POST | `/api/deleteUsersFromExcel` | Batch delete from Excel |
| GET | `/api/emps` | List employees (paginated) |
| GET | `/api/enrollInfo` | Get all enrollment data |
| GET | `/api/getUserInfo` | Get user enrollment from DB |
| GET | `/api/sendGetUserInfo` | Fetch user data from device |
| GET | `/api/setPersonToDevice` | Push all users to device |
| GET | `/api/setUsernameToDevice` | Push usernames to device |
| GET | `/api/setOneUser` | Push single user to device |
| GET | `/api/deletePersonFromDevice` | Delete user from device |

### Attendance Records
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/records` | Get attendance records (paginated) |
| GET | `/api/getAllLog` | Fetch all logs from device |
| GET | `/api/getNewLog` | Fetch new logs from device |

### Access Control
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/setAccessDay` | Set daily time zones |
| POST | `/api/setAccessWeek` | Set weekly access rules |
| POST | `/api/setLockGroup` | Set lock groups |
| POST | `/api/setDevLock` | Push full access config to all devices |
| POST | `/api/setUserLock` | Set per-user access restrictions |
| GET | `/api/accessDays` | Get access day rules |
| GET | `/api/accessWeeks` | Get access week rules |
| GET | `/api/getUserLock` | Get user lock parameters |

---

## How It Works

### Architecture

```
                    +-----------+
                    | Dashboard |  (Bootstrap 5 UI)
                    |  :3000    |
                    +-----+-----+
                          |
                    REST API (Express)
                          |
              +-----------+-----------+
              |                       |
        +-----+------+        +------+------+
        |  PostgreSQL |        | Command     |
        |  (Drizzle)  |        | Queue Job   |
        +-----+------+        +------+------+
              |                       |
              |              +--------+--------+
              |              | WebSocket :7788 |
              |              +--------+--------+
              |                       |
              |            +----------+----------+
              |            |          |          |
           +--+--+      +--+--+   +--+--+   +--+--+
           | DB  |      |Dev 1|   |Dev 2|   |Dev N|
           +-----+      +-----+   +-----+   +-----+
                      AI Face Recognition Terminals
```

### Command Flow

1. **API receives request** (e.g., push user to device)
2. **MachineCommand record created** in database (status: pending)
3. **SendOrderJob** picks it up every 1 second
4. **Sends via WebSocket** to the target device
5. **Device responds** with result
6. **Command marked complete** in database

### Device Communication

Devices connect to the WebSocket server on port **7788** and communicate using JSON messages. The protocol supports:

- **Device-initiated**: `reg` (registration), `sendlog` (attendance), `senduser` (enrollment)
- **Server-initiated**: `setuserinfo`, `deleteuser`, `getalllog`, `opendoor`, `setdevlock`, etc.

---

## Device Setup

Configure your face recognition terminal to connect to the WebSocket server:

1. Set **Server Address** to your server's IP
2. Set **Server Port** to `7788`
3. Set **Protocol** to WebSocket
4. The device will auto-register on first connection

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## Protocol Reference

This implementation is based on the **WebSocket + JSON Protocol v2.6** for cloud solution communication with face recognition terminals. The protocol uses RFC 6455 WebSocket with JSON payloads on port 7788 (no TLS).

## License

[MIT](LICENSE)
