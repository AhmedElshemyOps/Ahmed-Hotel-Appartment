import "dotenv/config";
import { Pool } from "pg";
import { runMarketWorkerOnce } from "../server/market/worker";
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
try {
  console.log(JSON.stringify(await runMarketWorkerOnce(pool)));
} finally {
  await pool.end();
}
