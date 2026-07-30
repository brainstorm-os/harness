// P2P-0 prototype — the case that actually matters for sleep/wake: the peer
// machine is ASLEEP, so it does not send a TCP RST, it sends nothing. Measures
// (a) how long a dial to a silent LAN address takes to give up with no deadline,
// (b) how an established socket behaves when the peer vanishes without a RST.
// NOT product code.

import { connect } from "node:net";

const log = (o) => console.log(JSON.stringify(o));

// (a) A LAN address in our own subnet with nothing on it: the OS cannot even
// ARP-resolve it, which is what a powered-down / sleeping peer looks like.
function dial(host, port, deadlineMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const s = connect({ host, port });
    let done = false;
    const finish = (outcome, extra = {}) => {
      if (done) return;
      done = true;
      s.destroy();
      resolve({ host, port, outcome, ms: Date.now() - t0, ...extra });
    };
    if (deadlineMs) setTimeout(() => finish("app-deadline-fired"), deadlineMs);
    s.once("connect", () => finish("connected"));
    s.once("error", (e) => finish("error", { code: e.code }));
  });
}

const silent = process.env.SILENT_IP ?? "192.168.2.231";
log({ test: "no-deadline (OS default)", ...(await dial(silent, 51000, 0)) });
log({ test: "with 3s app deadline", ...(await dial(silent, 51000, 3000)) });
log({ test: "closed port on a LIVE host (control)", ...(await dial("192.168.2.50", 51000, 0)) });
