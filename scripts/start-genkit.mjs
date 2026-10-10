import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

// Assicura che la directory config locale esista per evitare EPERM su ~/.config in ambienti sandboxed
const configDir = path.resolve(process.cwd(), ".genkit/config");
fs.mkdirSync(configDir, { recursive: true });

process.env.XDG_CONFIG_HOME = configDir;
process.env.GENKIT_ENV = "dev";

const args = ["start", "--", "tsx", "--watch", "lib/genkit/flows.ts", ...process.argv.slice(2)];
console.log("🚀 Avvio Genkit Developer UI con flussi PantryAI caricati in dev runtime...");

const child = spawn("npx", ["genkit", ...args], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
