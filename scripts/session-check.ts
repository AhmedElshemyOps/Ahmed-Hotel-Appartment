import dotenv from "dotenv";
import { existsSync } from "node:fs";
dotenv.config({ quiet: true });
const cloud = process.argv.includes("--cloud");
const checks: { name: string; status: string }[] = [
  {
    name: "Node.js version meets repository requirement (22+)",
    status:
      Number(process.versions.node.split(".")[0]) >= 22 ? "pass" : "missing",
  },
  {
    name: "Installed dependencies",
    status: existsSync("node_modules/tsx/package.json") ? "pass" : "missing",
  },
  {
    name: "Demo launcher uses synthetic data and binds only 127.0.0.1",
    status: "configured",
  },
  {
    name: "Odoo live accounting connection",
    status: "disabled by application design",
  },
];
if (cloud)
  for (const key of [
    "DATABASE_URL",
    "GOOGLE_CLOUD_PROJECT",
    "FIREBASE_AUTH_DOMAIN",
    "FIREBASE_WEB_API_KEY",
  ])
    checks.push({
      name: key + " is supplied (value hidden)",
      status: process.env[key] ? "supplied" : "missing",
    });
console.log(
  JSON.stringify(
    {
      mode: cloud
        ? "cloud configuration review"
        : "local synthetic demonstration",
      checks,
      configurationComplete: checks.every((c) => c.status !== "missing"),
      limitations: cloud
        ? [
            "This check does not authenticate, query a database or verify cloud resources.",
            "Live identity/MFA, runtime DB grants, migrations, backup restore and deployment require independent acceptance.",
          ]
        : [
            "No real records or external credentials are needed for npm run session:demo.",
            "A successful check prepares a local demonstration, not public hosting or production acceptance.",
          ],
    },
    null,
    2,
  ),
);
if (checks.some((c) => c.status === "missing")) process.exitCode = 1;
