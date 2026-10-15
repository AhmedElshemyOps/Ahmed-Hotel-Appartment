import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
test("production serves built assets and denies unauthenticated company access", async () => {
  const child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      APP_MODE: "cloud",
      PORT: "3078",
      DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
      GOOGLE_CLOUD_PROJECT: "demo-smoke",
      FIREBASE_AUTH_DOMAIN: "demo-smoke.firebaseapp.com",
      FIREBASE_WEB_API_KEY: "synthetic-key",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = once(child, "exit");
  let output = "";
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Production server did not start")),
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
        reject(Error("Production server exited before startup"));
      });
    });
    const health = await fetch("http://127.0.0.1:3078/healthz");
    assert.equal(health.status, 200);
    const page = await fetch("http://127.0.0.1:3078/");
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /\/assets\//);
    const asset = html.match(/src="(\/assets\/[^\"]+)"/)?.[1];
    assert.ok(asset);
    assert.equal((await fetch("http://127.0.0.1:3078" + asset)).status, 200);
    assert.equal(
      (await fetch("http://127.0.0.1:3078/api/workspace")).status,
      401,
    );
    assert.equal(
      (
        await fetch("http://127.0.0.1:3078/integrations/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      503,
    );
    assert.match(
      page.headers.get("content-security-policy") || "",
      /frame-ancestors 'none'/,
    );
  } finally {
    child.kill("SIGTERM");
    await exited;
  }
});
