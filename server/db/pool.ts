import { Pool } from "pg";
import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";
import { requireCloudConfiguration } from "../config/cloud";
export function cloudPool() {
  requireCloudConfiguration();
  if (!getApps().length)
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
    });
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
  });
}
