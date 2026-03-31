import { Pool } from 'pg';
import {config} from "../config";


export const pool = new Pool({
  connectionString: config.database.url,
  ssl: process.env.PGSSL?.toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined,
});

