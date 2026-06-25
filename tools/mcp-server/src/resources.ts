import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseOpenQuestions } from "./parse-oqs.ts";
import { parsePlan } from "./parse-plan.ts";
import { findRepoRoot, repoPath } from "./repo.ts";
import type { Iteration, Stage } from "./types.ts";

export enum ResourceScheme {
	Plan = "plan",
	OQ = "oq",
	Doc = "doc",
	Package = "package",
}

export interface ResourceDescriptor {
	uri: string;
	name: string;
	description: string;
	mimeType: string;
}

export interface ResourceContent {
	uri: string;
	mimeType: string;
	text: string;
}

/**
 * Resolves any `plan://` / `oq://` / `doc://` / `package://` URI to a
 * { uri, mimeType, text } payload, or throws `ResourceNotFound`.
 */
export function readResource(uri: string): ResourceContent {
	const parsed = parseUri(uri);
	switch (parsed.scheme) {
		case ResourceScheme.Plan:
			return readPlanResource(uri, parsed.path);
		case ResourceScheme.OQ:
			return readOQResource(uri, parsed.path);
		case ResourceScheme.Doc:
			return readDocResource(uri, parsed.path);
		case ResourceScheme.Package:
			return readPackageResource(uri, parsed.path);
	}
}

export class ResourceNotFound extends Error {
	constructor(public uri: string) {
		super(`Resource not found: ${uri}`);
		this.name = "ResourceNotFound";
	}
}

export class InvalidUri extends Error {
	constructor(uri: string, reason: string) {
		super(`Invalid resource URI '${uri}': ${reason}`);
		this.name = "InvalidUri";
	}
}

interface ParsedUri {
	scheme: ResourceScheme;
	path: string;
}

export function parseUri(uri: string): ParsedUri {
	const m = /^([a-z]+):\/\/(.+)$/.exec(uri);
	if (!m) throw new InvalidUri(uri, "expected '<scheme>://<path>'");
	const scheme = m[1];
	const path = m[2];
	if (!scheme || !path) throw new InvalidUri(uri, "missing scheme or path");
	switch (scheme) {
		case ResourceScheme.Plan:
			return { scheme: ResourceScheme.Plan, path };
		case ResourceScheme.OQ:
			return { scheme: ResourceScheme.OQ, path };
		case ResourceScheme.Doc:
			return { scheme: ResourceScheme.Doc, path };
		case ResourceScheme.Package:
			return { scheme: ResourceScheme.Package, path };
		default:
			throw new InvalidUri(uri, `unknown scheme '${scheme}'`);
	}
}

// ---------------------------------------------------------------------------
// plan://*

function readPlanResource(uri: string, path: string): ResourceContent {
	const plan = parsePlan(readPlanSource());
	if (path === "status") {
		return jsonContent(uri, { statusSnapshot: plan.statusSnapshot });
	}
	const stageMatch = /^stage\/([0-9]+[a-z]?)$/.exec(path);
	if (stageMatch?.[1]) {
		const stage = plan.stages.find((s: Stage) => s.stageId === stageMatch[1]);
		if (!stage) throw new ResourceNotFound(uri);
		return jsonContent(uri, stage);
	}
	const iterMatch = /^iteration\/(.+)$/.exec(path);
	if (iterMatch?.[1]) {
		const id = iterMatch[1];
		for (const stage of plan.stages) {
			const iteration = stage.iterations.find((i: Iteration) => i.id === id);
			if (iteration) return jsonContent(uri, iteration);
		}
		throw new ResourceNotFound(uri);
	}
	throw new InvalidUri(uri, "expected 'status', 'stage/<n>', or 'iteration/<n.m>'");
}

export function readPlanSource(): string {
	return readFileSync(repoPath("docs/implementation-plan.md"), "utf8");
}

export function readLogSource(): string {
	return readFileSync(repoPath("docs/implementation-log.md"), "utf8");
}

export function readPlanTableSource(): string {
	return readFileSync(repoPath("docs/implementation-plan-table.md"), "utf8");
}

// ---------------------------------------------------------------------------
// oq://*

function readOQResource(uri: string, path: string): ResourceContent {
	const oqs = parseOpenQuestions(readOQSource());
	const normalized = path.startsWith("OQ-") ? path : `OQ-${path}`;
	const oq = oqs.questions.find((q) => q.id === normalized);
	if (!oq) throw new ResourceNotFound(uri);
	return jsonContent(uri, oq);
}

export function readOQSource(): string {
	return readFileSync(repoPath("docs/reference/11-open-questions.md"), "utf8");
}

// ---------------------------------------------------------------------------
// doc://*

function readDocResource(uri: string, slug: string): ResourceContent {
	const filePath = resolveDocSlug(slug);
	if (!filePath) throw new ResourceNotFound(uri);
	const text = readFileSync(filePath, "utf8");
	const relPath = relative(findRepoRoot(), filePath);
	return { uri, mimeType: "text/markdown", text: `<!-- ${relPath} -->\n${text}` };
}

function resolveDocSlug(slug: string): string | null {
	const docsRoot = repoPath("docs");
	const exact = join(docsRoot, slug.endsWith(".md") ? slug : `${slug}.md`);
	if (existsSync(exact) && statSync(exact).isFile()) return exact;
	const matches = listDocFiles(docsRoot).filter((p) => {
		const base = (p.split("/").pop() ?? "").replace(/\.md$/, "");
		return base === slug || base.endsWith(`-${slug}`) || base.startsWith(`${slug}-`);
	});
	return matches[0] ?? null;
}

function listDocFiles(root: string): string[] {
	const out: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir)) {
			const full = join(dir, entry);
			const stat = statSync(full);
			if (stat.isDirectory()) walk(full);
			else if (entry.endsWith(".md")) out.push(full);
		}
	};
	walk(root);
	return out;
}

// ---------------------------------------------------------------------------
// package://*

function readPackageResource(uri: string, name: string): ResourceContent {
	const candidates = [
		repoPath("packages", name, "package.json"),
		repoPath("packages", stripScope(name), "package.json"),
		repoPath("apps", name, "package.json"),
		repoPath("apps", stripScope(name), "package.json"),
		repoPath("tools", name, "package.json"),
		repoPath("tools", stripScope(name), "package.json"),
	];
	const found = candidates.find((p) => existsSync(p));
	if (!found) throw new ResourceNotFound(uri);
	const pkg = JSON.parse(readFileSync(found, "utf8"));
	const relPath = relative(findRepoRoot(), found);
	return jsonContent(uri, { package: pkg, path: relPath });
}

function stripScope(name: string): string {
	return name.startsWith("@") ? (name.split("/")[1] ?? name) : name;
}

// ---------------------------------------------------------------------------
// helpers

function jsonContent(uri: string, value: unknown): ResourceContent {
	return { uri, mimeType: "application/json", text: JSON.stringify(value, null, 2) };
}

/**
 * Top-level resources advertised on `resources/list` — point clients at the
 * stable entry-point URIs. URIs like `plan://stage/9` or `oq://OQ-34` work
 * even though they aren't listed.
 */
export function listResources(): ResourceDescriptor[] {
	return [
		{
			uri: "plan://status",
			name: "Plan status snapshot",
			description: "Top-of-doc status table from docs/implementation-plan.md",
			mimeType: "application/json",
		},
		{
			uri: "doc://implementation-log",
			name: "Implementation log (completed work)",
			description:
				"Per-iteration narrative + build/test signals for shipped iterations, split out of the plan (docs/implementation-log.md).",
			mimeType: "text/markdown",
		},
	];
}
