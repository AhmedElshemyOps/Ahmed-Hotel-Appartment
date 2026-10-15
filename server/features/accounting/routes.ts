import { Router } from "express";
import type { Pool } from "pg";
import { registerAccountingWorkflows } from "./service";
export { loadAccounting } from "./repository";

export function accountingRouter(pool: Pool) {
  const router = Router();
  registerAccountingWorkflows(router, pool);
  return router;
}
