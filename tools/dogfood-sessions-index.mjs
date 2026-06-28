/**
 * Regenerate tests/dogfood/sessions/INDEX.md — the canonical manifest of every
 * dogfood session spec, so "which sessions exist" is knowable again after the
 * numbering diverged (two early arcs reused 001–028; themed sweeps like 228
 * group many specs under one number).
 *
 * Source of truth = the spec filenames on disk. Run after adding/removing a
 * session spec:  bun tools/dogfood-sessions-index.mjs   (also wired into lint).
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "tests/dogfood/sessions";
const LEAD = /^(\d+)([a-z]?)-(.+)\.spec\.ts$/;

const files = readdirSync(DIR)
	.filter((f) => f.endsWith(".spec.ts"))
	.sort();

/** @type {Map<number, {file: string, suffix: string, slug: string}[]>} */
const byNumber = new Map();
const unparsed = [];
for (const file of files) {
	const m = file.match(LEAD);
	if (!m) {
		unparsed.push(file);
		continue;
	}
	const num = Number(m[1]);
	const entry = { file, suffix: m[2] ?? "", slug: m[3] ?? "" };
	const list = byNumber.get(num) ?? [];
	list.push(entry);
	byNumber.set(num, list);
}

const numbers = [...byNumber.keys()].sort((a, b) => a - b);
const maxNum = numbers.length ? numbers[numbers.length - 1] : 0;
// A "shared" number is any used by more than one spec — whether an accidental
// two-arc collision (001–028) or a deliberate themed sweep (228, 332). The two
// cases can't be told apart from filenames, so the manifest just surfaces the
// fact (×N) and the header names the known instances; the reader judges.
const shared = numbers.filter((n) => (byNumber.get(n) ?? []).length > 1);

const rows = [];
for (const n of numbers) {
	const list = byNumber.get(n) ?? [];
	const pad = String(n).padStart(3, "0");
	const flag = list.length > 1 ? ` ×${list.length}` : "";
	rows.push(`| ${pad}${flag} | ${list.map((e) => `\`${e.file}\``).join("<br>")} |`);
}

const out = `# Dogfood sessions — index

> **Generated** by \`tools/dogfood-sessions-index.mjs\` from the spec filenames in
> this directory. Do not hand-edit; run \`bun tools/dogfood-sessions-index.mjs\`.

The dogfood "session number" is the leading integer of each spec filename. It is a
loose ordering prefix, **not** a clean sequence. A number used by more than one spec is
marked \`×N\` in the manifest; there are two reasons a number is shared:

- **Accidental two-arc collisions: 011–028.** A "Mira build-the-business" narrative arc
  and an app-sweep / probe arc both numbered from 011, so each of 011–028 has two
  unrelated specs. They are **left in place** — renaming would break the slug references
  in \`docs/dogfood/friction-log.md\`; this index is how you disambiguate them.
- **Deliberate themed sweeps: e.g. 228 (×20), 332.** One number reserved for a cohort of
  related specs (\`228-deep-mailbox\`, \`228-deep-agent\`, …). That is allowed.

The two cases look identical from filenames, so the manifest just reports \`×N\`; use the
slugs to tell which is which.

## Go-forward rule (the fix for the divergence)

1. **A new dogfood session takes the next integer: \`${String(maxNum + 1).padStart(3, "0")}\`.** Never reuse an
   existing number for an unrelated session.
2. **A single themed sweep may group multiple specs under one reserved number** using
   \`NNN-<topic>-<facet>.spec.ts\` naming (the \`228\` pattern). Reserve the number once.
3. Regenerate this index in the same change (\`bun tools/dogfood-sessions-index.mjs\`).

## Manifest

- **Total spec files:** ${files.length}
- **Distinct session numbers:** ${numbers.length}
- **Highest number:** ${maxNum} → **next session = ${maxNum + 1}**
- **Numbers shared by >1 spec (\`×N\`):** ${shared.length}

| Session | Spec file(s) |
| ------- | ------------ |
${rows.join("\n")}
${unparsed.length ? `\n### Unparsed (non-conforming filenames)\n\n${unparsed.map((f) => `- \`${f}\``).join("\n")}\n` : ""}`;

writeFileSync(join(DIR, "INDEX.md"), out);
console.log(
	`dogfood index: ${files.length} specs, ${numbers.length} numbers, ` +
		`${shared.length} shared, next session = ${maxNum + 1}`,
);
