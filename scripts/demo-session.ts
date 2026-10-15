import "dotenv/config";
import { spawn } from "node:child_process";
// A demonstration is always loopback-only and synthetic, regardless of .env cloud settings.
const child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
  env: {
    ...process.env,
    APP_MODE: "demo",
    NODE_ENV: "development",
    APP_HOST: "127.0.0.1",
    GEMINI_API_KEY: "",
    DISABLE_HMR: "true",
  },
  stdio: "inherit",
});
console.log(
  "SYNTHETIC SESSION: local computer only. No real company records or live AI connection.",
);
console.log(
  "Demo edits may reset when you leave a module. Use September 2026 for the accounting fixture.",
);
child.on("error", () => {
  console.error(
    "Could not start the demonstration server. Check Node.js and dependency installation.",
  );
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
