// P2P-0 prototype — the exact sleep/wake case. SIGSTOP freezes the host
// process: the socket stays open, the kernel sends no RST, nothing is ever
// answered. That is what a laptop going to sleep mid-session looks like to the
// other end. Measures how long the client takes to notice, with and without an
// application-level heartbeat. NOT product code.

import { WebSocketServer } from "ws";
import WebSocket from "ws";
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

const log = (o) => console.log(JSON.stringify(o));
const LAN_IP = Object.values(networkInterfaces())
  .flat()
  .find((n) => n && n.family === "IPv4" && !n.internal).address;

// Host in a child process so we can SIGSTOP it.
const child = spawn(
  "node",
  [
    "-e",
    `const {WebSocketServer}=require("ws");
     const wss=new WebSocketServer({host:"${LAN_IP}",port:0});
     wss.on("listening",()=>console.log(JSON.stringify({port:wss.address().port})));
     wss.on("connection",ws=>{ws.on("message",m=>ws.send(m));});`,
  ],
  { cwd: import.meta.dirname, stdio: ["ignore", "pipe", "inherit"] },
);
const port = await new Promise((r) => child.stdout.once("data", (d) => r(JSON.parse(d.toString()).port)));

const ws = new WebSocket(`ws://${LAN_IP}:${port}`);
await new Promise((r) => ws.once("open", r));
log({ phase: "connected", port });

// Prove the link is live.
await new Promise((r) => {
  ws.once("message", r);
  ws.send("ping-0");
});
log({ phase: "echo-ok" });

const tFreeze = Date.now();
child.kill("SIGSTOP");
log({ phase: "host-SIGSTOPped", note: "socket open, no RST, no answers - a sleeping peer" });

// A: what the transport tells us on its own (no heartbeat, like WebSocketRelayPort today)
let noticed = null;
ws.once("close", () => (noticed = Date.now() - tFreeze));
ws.once("error", () => (noticed = Date.now() - tFreeze));

// B: an application heartbeat with a 5s answer deadline
const HEARTBEAT_MS = 2000;
const ANSWER_DEADLINE_MS = 5000;
let lastPong = Date.now();
ws.on("message", () => (lastPong = Date.now()));
const hb = setInterval(() => {
  try {
    ws.send("hb");
  } catch {}
}, HEARTBEAT_MS);

const heartbeatNoticedMs = await new Promise((resolve) => {
  const t = setInterval(() => {
    if (Date.now() - lastPong > ANSWER_DEADLINE_MS) {
      clearInterval(t);
      clearInterval(hb);
      resolve(Date.now() - tFreeze);
    }
    if (Date.now() - tFreeze > 60000) {
      clearInterval(t);
      clearInterval(hb);
      resolve(null);
    }
  }, 100);
});

log({
  phase: "detection",
  heartbeatNoticedMs,
  transportNoticedMs: noticed,
  note: "transportNoticedMs null => the socket looked healthy the whole time",
});

// Now wake it and see whether the socket was actually still usable.
child.kill("SIGCONT");
const woke = await new Promise((r) => {
  const to = setTimeout(() => r({ usable: false }), 5000);
  ws.once("message", () => {
    clearTimeout(to);
    r({ usable: true });
  });
  try {
    ws.send("post-wake");
  } catch (e) {
    clearTimeout(to);
    r({ usable: false, err: e.message });
  }
});
log({ phase: "after-wake", ...woke, totalFrozenMs: Date.now() - tFreeze });

child.kill("SIGKILL");
ws.terminate();
process.exit(0);
