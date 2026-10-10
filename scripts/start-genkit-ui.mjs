import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const configDir = path.resolve(process.cwd(), ".genkit/config");
fs.mkdirSync(configDir, { recursive: true });

process.env.XDG_CONFIG_HOME = configDir;

const args = ["ui:start", "--port", "4000", ...process.argv.slice(2)];
console.log("🚀 Avvio Genkit Developer UI Standalone su porta 4000...");

const child = spawn("npx", ["genkit", ...args], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
