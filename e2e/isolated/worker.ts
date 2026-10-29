import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
export const web = join(root, "apps", "web");
const wrangler = join(web, "node_modules", "wrangler", "bin", "wrangler.js");

export function command(args: readonly string[]): void {
  execFileSync(process.execPath, [wrangler, ...args], { cwd: web, stdio: "pipe" });
}

export async function availablePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await new Promise<void>((ready) => server.once("listening", ready));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("No local TCP port available");
  }
  await new Promise<void>((closed, rejectClose) =>
    server.close((error) => {
      if (error !== undefined) {
        rejectClose(error);
      } else {
        closed();
      }
    }),
  );
  return address.port;
}

export function startWorker(state: string, url: string, port: number): ChildProcess {
  return spawn(
    process.execPath,
    [
      wrangler,
      "dev",
      "-c",
      "dist/server/wrangler.json",
      "--persist-to",
      state,
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--var",
      "ACCESS_TEAM_DOMAIN:http://127.0.0.1:8799",
      "--var",
      "ACCESS_AUDIENCE:zsm3-dev",
      "--var",
      `PANEL_ORIGIN:${url}`,
    ],
    {
      cwd: web,
      detached: process.platform !== "win32",
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    },
  );
}

function hasExited(worker: ChildProcess): boolean {
  return worker.exitCode !== null || worker.signalCode !== null;
}

async function waitForExit(worker: ChildProcess): Promise<void> {
  if (hasExited(worker)) {
    return;
  }
  await new Promise<void>((resolveExit, rejectExit) => {
    const timer = setTimeout(() => {
      worker.off("exit", onExit);
      rejectExit(new Error("Isolated worker did not stop within 8 seconds"));
    }, 8_000);
    function onExit(): void {
      clearTimeout(timer);
      resolveExit();
    }
    worker.once("exit", onExit);
    if (hasExited(worker)) {
      worker.off("exit", onExit);
      onExit();
    }
  });
}

function killTree(worker: ChildProcess): void {
  if (worker.pid === undefined) {
    worker.kill();
    return;
  }
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(worker.pid), "/T", "/F"], {
        stdio: "ignore",
        timeout: 5_000,
      });
    } else {
      process.kill(-worker.pid, "SIGTERM");
    }
  } catch {
    worker.kill();
  }
}

export async function stopWorker(worker: ChildProcess): Promise<void> {
  if (hasExited(worker)) {
    return;
  }
  killTree(worker);
  await waitForExit(worker);
}
