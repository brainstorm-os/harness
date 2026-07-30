// P2P-0 prototype — is multicast DNS actually propagating on THIS LAN, between
// DIFFERENT machines? Browses the service-type meta-query and a few common
// types, then resolves each instance and records which host answered and how
// long the resolve took. Any address that is not ours is cross-machine
// evidence. NOT product code.

import { Bonjour } from "bonjour-service";
import { networkInterfaces } from "node:os";

const mine = new Set(
  Object.values(networkInterfaces())
    .flat()
    .filter(Boolean)
    .map((n) => n.address),
);

const bonjour = new Bonjour();
const types = ["googlecast", "airplay", "raop", "ipp", "printer", "http", "smb", "companion-link", "homekit", "spotify-connect", "workstation", "sftp-ssh", "device-info"];
const seen = new Map();
const t0 = Date.now();

for (const type of types) {
  const b = bonjour.find({ type, protocol: "tcp" });
  b.on("up", (svc) => {
    const addrs = (svc.addresses || []).filter((a) => a.includes("."));
    const remote = addrs.filter((a) => !mine.has(a));
    const key = `${type}/${svc.name}`;
    if (seen.has(key)) return;
    seen.set(key, { type, name: svc.name, host: svc.host, addrs, remote: remote.length > 0, ms: Date.now() - t0 });
  });
}

setTimeout(() => {
  const rows = [...seen.values()].sort((a, b) => a.ms - b.ms);
  const hosts = new Set(rows.flatMap((r) => r.addrs));
  const remoteHosts = [...hosts].filter((h) => !mine.has(h));
  console.log(
    JSON.stringify(
      {
        instancesFound: rows.length,
        distinctIPv4Hosts: hosts.size,
        remoteIPv4Hosts: remoteHosts,
        firstRemoteResolveMs: rows.find((r) => r.remote)?.ms ?? null,
        rows: rows.slice(0, 12),
      },
      null,
      2,
    ),
  );
  bonjour.destroy();
  process.exit(0);
}, 10000);
