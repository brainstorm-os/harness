// P2P-0 throwaway prototype — PEER side.
// Browses mDNS for _brainstorm-sync._tcp, dials the discovered address, runs
// the admission-shaped handshake, and reports timings. NOT product code.

import { Bonjour } from "bonjour-service";
import WebSocket from "ws";
import {
  createDecipheriv,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  sign,
  verify,
} from "node:crypto";

const ed = generateKeyPairSync("ed25519");
const x = generateKeyPairSync("x25519");
const account = ed.publicKey.export({ type: "spki", format: "der" }).toString("base64url");
const x25519Pub = x.publicKey.export({ type: "spki", format: "der" }).toString("base64url");

const tStart = Date.now();
const bonjour = new Bonjour();
const browser = bonjour.find({ type: "brainstorm-sync", protocol: "tcp" });

const found = await new Promise((resolve, reject) => {
  const to = setTimeout(() => reject(new Error("mdns-timeout-15s")), 15000);
  browser.on("up", (svc) => {
    clearTimeout(to);
    resolve(svc);
  });
});
const tDiscovered = Date.now();
console.log(
  JSON.stringify({
    ev: "discovered",
    ms: tDiscovered - tStart,
    name: svcName(found),
    host: found.host,
    addresses: found.addresses,
    port: found.port,
    txt: found.txt,
  }),
);

function svcName(s) {
  return s.name;
}

const addr = (found.addresses || []).find((a) => a.includes(".")) ?? found.host;
const url = `ws://${addr}:${found.port}`;

const tDial = Date.now();
const ws = new WebSocket(url);
await new Promise((r, j) => {
  ws.once("open", r);
  ws.once("error", j);
});
const tOpen = Date.now();
console.log(JSON.stringify({ ev: "tcp+ws-open", url, ms: tOpen - tDial }));

const tHs = Date.now();
ws.send(JSON.stringify({ op: "hello", account, x25519Pub }));

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.op === "challenge") {
    const t0 = process.hrtime.bigint();
    const encPub = createPublicKey({ key: Buffer.from(msg.enc, "base64url"), format: "der", type: "spki" });
    const shared = diffieHellman({ privateKey: x.privateKey, publicKey: encPub });
    const aad = Buffer.from(`${msg.hostAccount}|${account}`);
    const key = Buffer.from(hkdfSync("sha256", shared, Buffer.alloc(0), aad, 32));
    const ctFull = Buffer.from(msg.ct, "base64url");
    const d = createDecipheriv("chacha20-poly1305", key, Buffer.from(msg.iv, "base64url"), { authTagLength: 16 });
    d.setAAD(aad);
    d.setAuthTag(ctFull.subarray(ctFull.length - 16));
    const nonce = Buffer.concat([d.update(ctFull.subarray(0, ctFull.length - 16)), d.final()]);
    const sig = sign(
      null,
      Buffer.from(`brainstorm/lan-admission/v1|${msg.hostAccount}|${account}|${nonce.toString("base64url")}`),
      ed.privateKey,
    );
    const t1 = process.hrtime.bigint();
    console.log(JSON.stringify({ ev: "open+sign", us: Number(t1 - t0) / 1000 }));
    globalThis.__nonce = nonce;
    globalThis.__hostAccount = msg.hostAccount;
    ws.send(JSON.stringify({ op: "auth", account, sig: sig.toString("base64url") }));
    return;
  }
  if (msg.op === "auth-ok") {
    const hostEd = createPublicKey({
      key: Buffer.from(msg.hostAccount, "base64url"),
      format: "der",
      type: "spki",
    });
    const ok = verify(
      null,
      Buffer.from(
        `brainstorm/lan-admission/v1/host|${account}|${globalThis.__nonce.toString("base64url")}`,
      ),
      hostEd,
      Buffer.from(msg.proof, "base64url"),
    );
    console.log(
      JSON.stringify({
        ev: "admitted",
        hostVerified: ok,
        handshakeMs: Date.now() - tHs,
        discoveryToAdmittedMs: Date.now() - tStart,
      }),
    );
    ws.close();
    bonjour.destroy();
    process.exit(0);
  }
});
