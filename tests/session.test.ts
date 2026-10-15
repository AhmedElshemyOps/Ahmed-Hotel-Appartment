import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
test("session configuration report never prints supplied secrets or claims cloud acceptance", () => {
  const marker = "SYNTHETIC-SECRET-DO-NOT-DISPLAY";
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "scripts/session-check.ts", "--cloud"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: marker,
        GOOGLE_CLOUD_PROJECT: "test",
        FIREBASE_AUTH_DOMAIN: "test.invalid",
        FIREBASE_WEB_API_KEY: marker,
        GEMINI_API_KEY: marker,
      },
    },
  );
  assert.equal(output.includes(marker), false);
  const report = JSON.parse(output);
  assert.equal(report.configurationComplete, true);
  assert.match(report.limitations.join(" "), /does not authenticate/);
});
test("synthetic session overrides cloud/production settings and disables live AI", async () => {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "scripts/demo-session.ts"],
    {
      env: {
        ...process.env,
        PORT: "3079",
        APP_MODE: "cloud",
        NODE_ENV: "production",
        APP_HOST: "0.0.0.0",
        GEMINI_API_KEY: "SYNTHETIC-SECRET",
        DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const exited = once(child, "exit");
  let output = "";
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Session server did not start")),
        15000,
      );
      child.stdout.on("data", (chunk) => {
        output += chunk;
        if (output.includes("active on")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(Error("Session exited before startup"));
      });
    });
    assert.match(output, /http:\/\/127\.0\.0\.1:3079/);
    assert.equal(output.includes("SYNTHETIC-SECRET"), false);
    const config = await (
      await fetch("http://127.0.0.1:3079/api/config")
    ).json();
    assert.equal(config.cloudMode, false);
    const health = await (
      await fetch("http://127.0.0.1:3079/api/health")
    ).json();
    assert.equal(health.hasGeminiApiKey, false);
  } finally {
    child.kill("SIGTERM");
    await exited;
  }
});
