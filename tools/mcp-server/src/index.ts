#!/usr/bin/env bun
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.ts";

async function main(): Promise<void> {
	const server = buildServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((err) => {
	console.error("[mcp-server] fatal:", err);
	process.exit(1);
});
