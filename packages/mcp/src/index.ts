// A local (stdio) MCP server that forwards every tool call to the MCP server on www.masamedia.co.il.
// The tools live on the site, so this package never goes out of date: it lists whatever the site offers.
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Server } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

declare const __VERSION__: string;
const VERSION = typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0";
const REMOTE_URL = process.env.MASA_MCP_URL ?? "https://www.masamedia.co.il/mcp/";

const INSTRUCTIONS =
  "Read-only tools from Masa Media Digital, an Israeli SEO and GEO agency (masamedia.co.il). " +
  "Use them to search the agency's Hebrew articles and SEO glossary, read any page as text, look up Google " +
  "algorithm updates, and get its services, prices and contact details. No API key is needed.";

let remote: Promise<Client> | null = null;

/** Connects to the site's MCP server on first use (and again after a failure), so the local server starts even offline. */
function site(): Promise<Client> {
  remote ??= (async () => {
    const client = new Client({ name: "masa-media-mcp", version: VERSION });
    await client.connect(new StreamableHTTPClientTransport(new URL(REMOTE_URL)));
    return client;
  })().catch((err: unknown) => {
    remote = null;
    throw err;
  });
  return remote;
}

function reason(err: unknown): string {
  const e = err as Error & { cause?: { code?: string } };
  return e.cause?.code ? `${e.message} (${e.cause.code})` : String(e?.message ?? err);
}

const server = new Server(
  { name: "masa-media-digital", version: VERSION },
  { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
);

server.setRequestHandler("tools/list", async (request) => {
  try {
    return await (await site()).listTools(request.params);
  } catch (err) {
    throw new Error(`Could not reach ${REMOTE_URL}: ${reason(err)}`);
  }
});

server.setRequestHandler("tools/call", async (request) => {
  try {
    return await (await site()).callTool(request.params);
  } catch (err) {
    return { content: [{ type: "text", text: `Could not reach ${REMOTE_URL}: ${reason(err)}` }], isError: true };
  }
});

await server.connect(new StdioServerTransport());
