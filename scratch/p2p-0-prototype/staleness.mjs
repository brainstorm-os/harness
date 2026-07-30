// P2P-0 prototype — what a sleeping / vanishing peer looks like to the other
// side. SIGKILLs the host (no mDNS goodbye packet, exactly like a laptop lid
// closing or a crash), then measures:
//   1. how long until the browser reports the service down (if ever),
//   2. what a dial to the cached-but-dead address costs,
//   3. how long until a restarted host on a NEW port is rediscovered.
// NOT product code.

import { Bonjour } from "bonjour-service";
import WebSocket from "ws";
import { spawn } from "node:child_process";

const log = (o) => console.log(JSON.stringify(o));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startHost() {
  const p = spawn("node", ["host.mjs"], { cwd: import.meta.dirname, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((resolve) => {
    p.stdout.on("data", (d) => {
      for (const line of d.toString().trim().split("\n")) {
        try {
          const m = JSON.parse(line);
          if (m.ev === "listening") resolve({ proc: p, port: m.port, host: m.host });
        } catch {}
      }
    });
  });
}

const bonjour = new Bonjour();
const browser = bonjour.find({ type: "brainstorm-sync", protocol: "tcp" });
const events = [];
browser.on("up", (s) => events.push({ ev: "up", name: s.name, port: s.port, t: Date.now() }));
browser.on("down", (s) => events.push({ ev: "down", name: s.name, t: Date.now() }));

const h1 = await startHost();
await sleep(2000);
log({ phase: "host-1-running", port: h1.port, discovered: events.filter((e) => e.ev === "up").length });

const tKill = Date.now();
h1.proc.kill("SIGKILL");
log({ phase: "host-1-SIGKILLed", note: "no mDNS goodbye packet, like a lid close" });

// 2. dial the cached-but-dead address
await sleep(500);
const tDial = Date.now();
const dead = await new Promise((r) => {
  const ws = new WebSocket(`ws://${h1.host}:${h1.port}`);
  const to = setTimeout(() => {
    ws.terminate();
    r({ outcome: "timeout-10s" });
  }, 10000);
  ws.once("open", () => {
    clearTimeout(to);
    ws.close();
    r({ outcome: "unexpectedly-open" });
  });
  ws.once("error", (e) => {
    clearTimeout(to);
    r({ outcome: "error", code: e.code ?? e.message });
  });
});
log({ phase: "dial-dead-address", ...dead, ms: Date.now() - tDial });

// 1. does the browser ever report it down?
await sleep(20000);
const down = events.find((e) => e.ev === "down");
log({
  phase: "goes-away-detection",
  reportedDown: Boolean(down),
  msAfterKill: down ? down.t - tKill : null,
  note: "browser was left running the whole time",
});

// 3. restart on a new ephemeral port, measure rediscovery
const tRestart = Date.now();
const h2 = await startHost();
await sleep(8000);
const up2 = events.filter((e) => e.ev === "up" && e.port === h2.port)[0];
log({
  phase: "rediscovery-after-restart",
  newPort: h2.port,
  portChanged: h2.port !== h1.port,
  rediscoveredMs: up2 ? up2.t - tRestart : null,
  allEvents: events.map((e) => ({ ...e, t: e.t - tKill })),
});

h2.proc.kill("SIGKILL");
bonjour.destroy();
process.exit(0);
