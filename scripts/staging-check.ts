import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH, quiet: true });
const required = [
  "STAGING_PROJECT_ID",
  "STAGING_DATABASE_URL",
  "STAGING_FIREBASE_PROJECT_ID",
  "STAGING_PRIVATE_BUCKET",
  "PRODUCTION_PROJECT_ID",
  "GOOGLE_CLOUD_PROJECT",
  "DATABASE_URL",
  "PRIVATE_UPLOAD_BUCKET",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_WEB_API_KEY",
];
const checks = required.map((name) => ({
  name,
  status: process.env[name] ? "configured" : "missing",
}));
const distinct = Boolean(
  process.env.STAGING_PROJECT_ID &&
  process.env.PRODUCTION_PROJECT_ID &&
  process.env.STAGING_PROJECT_ID !== process.env.PRODUCTION_PROJECT_ID,
);
const identityMatches = Boolean(
  process.env.STAGING_PROJECT_ID &&
  process.env.STAGING_FIREBASE_PROJECT_ID === process.env.STAGING_PROJECT_ID,
);
checks.push(
  {
    name: "Separate staging and production projects",
    status: distinct ? "configured" : "missing",
  },
  {
    name: "Staging identity project matches staging app",
    status: identityMatches ? "configured" : "missing",
  },
);
checks.push({
  name: "Runtime uses the declared staging project, database and bucket",
  status:
    process.env.GOOGLE_CLOUD_PROJECT === process.env.STAGING_PROJECT_ID &&
    process.env.DATABASE_URL === process.env.STAGING_DATABASE_URL &&
    process.env.PRIVATE_UPLOAD_BUCKET === process.env.STAGING_PRIVATE_BUCKET
      ? "configured"
      : "missing",
});
checks.push({
  name: "Cloud staging runtime flags",
  status:
    process.env.APP_ENV === "staging" &&
    process.env.APP_MODE === "cloud" &&
    process.env.NODE_ENV === "production"
      ? "configured"
      : "missing",
});
console.log(
  JSON.stringify(
    {
      purpose: "Configuration presence check only",
      checks,
      readyToVerify: checks.every((c) => c.status === "configured"),
      notVerified: [
        "Cloud resources and IAM",
        "Real MFA and invited-account onboarding",
        "Company isolation and concurrent invitations",
        "Private bucket settings and real virus scanner",
        "Backup and restore against the isolated database",
      ],
      next: "Use docs/reference/STAGING.md; do not claim a live rehearsal passed from this check.",
    },
    null,
    2,
  ),
);
if (checks.some((c) => c.status !== "configured")) process.exitCode = 1;
