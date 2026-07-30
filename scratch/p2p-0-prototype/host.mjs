// P2P-0 throwaway prototype — HOST side.
// Advertises _brainstorm-sync._tcp over mDNS and binds a WebSocket listener on
// the real LAN interface, then runs an admission-shaped handshake.
// NOT product code. Measures discovery + connect + handshake cost.

import { Bonjour } from "bonjour-service";
import { WebSocketServer } from "ws";
import { createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes, sign, verify } from "node:crypto";
import { createCipheriv } from "node:crypto";
import { networkInterfaces } from "node:os";

const LAN_IP = Object.values(networkInterfaces())
  .flat()
  .find((n) => n && n.family === "IPv4" && !n.internal)?.address;

// Static per-device keys, exactly the shape the shipped roster carries.
const ed = generateKeyPairSync("ed25519");
const x = generateKeyPairSync("x25519");
const hostAccount = ed.publicKey.export({ type: "spki", format: "der" }).toString("base64url");
const hostX25519Pub = x.publicKey.export({ type: "spki", format: "der" }).toString("base64url");

const wss = new WebSocketServer({ host: LAN_IP, port: 0 });
await new Promise((r) => wss.once("listening", r));
const port = wss.address().port;
console.log(JSON.stringify({ ev: "listening", host: LAN_IP, port, hostAccount, hostX25519Pub }));

const bonjour = new Bonjour();
// Minimal, non-linking TXT: an ephemeral per-session instance id only.
const instanceId = randomBytes(8).toString("hex");
const service = bonjour.publish({
  name: `brainstorm-${instanceId}`,
  type: "brainstorm-sync",
  protocol: "tcp",
  port,
  txt: { v: "1", sid: instanceId },
});
service.on("up", () => console.log(JSON.stringify({ ev: "advertised", instanceId, t: Date.now() })));

wss.on("connection", (ws, req) => {
  const tConn = Date.now();
  console.log(JSON.stringify({ ev: "connection", from: req.socket.remoteAddress, t: tConn }));
  let nonce = null;
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.op === "hello") {
      // Roster lookup would happen here; the prototype trusts the peer's claim
      // because we are measuring cost, not enforcing policy.
      const t0 = process.hrtime.bigint();
      nonce = randomBytes(32);
      // HPKE base mode, approximated with the primitives node exposes:
      // ephemeral X25519 -> DH against the peer's static key -> HKDF -> AEAD seal.
      const eph = generateKeyPairSync("x25519");
      const peerPub = createPublicKey({
        key: Buffer.from(msg.x25519Pub, "base64url"),
        format: "der",
        type: "spki",
      });
      const shared = diffieHellman({ privateKey: eph.privateKey, publicKey: peerPub });
      const aad = Buffer.from(`${hostAccount}|${msg.account}`);
      const key = Buffer.from(hkdfSync("sha256", shared, Buffer.alloc(0), aad, 32));
      const iv = randomBytes(12);
      const c = createCipheriv("chacha20-poly1305", key, iv, { authTagLength: 16 });
      c.setAAD(aad);
      const ct = Buffer.concat([c.update(nonce), c.final(), c.getAuthTag()]);
      const t1 = process.hrtime.bigint();
      console.log(JSON.stringify({ ev: "seal", us: Number(t1 - t0) / 1000 }));
      ws.send(
        JSON.stringify({
          op: "challenge",
          enc: eph.publicKey.export({ type: "spki", format: "der" }).toString("base64url"),
          iv: iv.toString("base64url"),
          ct: ct.toString("base64url"),
          hostAccount,
        }),
      );
      return;
    }
    if (msg.op === "auth") {
      const t0 = process.hrtime.bigint();
      const transcript = Buffer.from(
        `brainstorm/lan-admission/v1|${hostAccount}|${msg.account}|${nonce.toString("base64url")}`,
      );
      const peerEd = createPublicKey({
        key: Buffer.from(msg.account, "base64url"),
        format: "der",
        type: "spki",
      });
      const ok = verify(null, transcript, peerEd, Buffer.from(msg.sig, "base64url"));
      const proof = sign(
        null,
        Buffer.from(`brainstorm/lan-admission/v1/host|${msg.account}|${nonce.toString("base64url")}`),
        ed.privateKey,
      );
      const t1 = process.hrtime.bigint();
      console.log(JSON.stringify({ ev: "verify", ok, us: Number(t1 - t0) / 1000 }));
      ws.send(JSON.stringify({ op: ok ? "auth-ok" : "auth-fail", proof: proof.toString("base64url"), hostAccount }));
    }
  });
  ws.on("close", () => console.log(JSON.stringify({ ev: "close", t: Date.now() })));
});

process.on("SIGINT", () => {
  bonjour.unpublishAll(() => bonjour.destroy());
  process.exit(0);
});
