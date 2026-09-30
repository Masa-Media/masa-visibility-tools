// Runs the built server (dist/index.js, so run `pnpm build` first) over stdio, pointed at a local stand-in for the
// site's MCP server: checks that tools are listed and calls are forwarded, with no internet needed.
import { createServer, type Server as HttpServer } from "node:http";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const BIN = fileURLToPath(new URL("../dist/index.js", import.meta.url));

type Rpc = { jsonrpc: "2.0"; id?: number | string; method: string; params?: Record<string, unknown> };

// A minimal stateless Streamable HTTP MCP server that answers with plain JSON, like the site's.
function answer(msg: Rpc): unknown {
  switch (msg.method) {
    case "initialize":
      return {
        protocolVersion: msg.params?.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "stand-in", version: "1.0.0" },
      };
    case "tools/list":
      return {
        tools: [
          {
            name: "echo",
            description: "Echo the text back",
            inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
          },
        ],
      };
    case "tools/call": {
      const args = (msg.params?.arguments ?? {}) as { text?: string };
      return { content: [{ type: "text", text: `echo: ${args.text}` }] };
    }
    default:
      return null;
  }
}

let http: HttpServer;
let url = "";

beforeAll(async () => {
  http = createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const msg = JSON.parse(body) as Rpc;
      if (msg.id === undefined) {
        res.writeHead(202).end();
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: answer(msg) }));
    });
  });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const address = http.address();
  if (address && typeof address === "object") url = `http://127.0.0.1:${address.port}/mcp/`;
});

afterAll(() => new Promise<void>((resolve) => http.close(() => resolve())));

async function connect(remoteUrl: string): Promise<Client> {
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: [BIN], env: { ...process.env, MASA_MCP_URL: remoteUrl } as Record<string, string> }),
  );
  return client;
}

describe("@masamedia/mcp", () => {
  it("introduces itself and lists the remote server's tools", async () => {
    const client = await connect(url);
    expect(client.getServerVersion()?.name).toBe("masa-media-digital");
    expect(client.getInstructions()).toContain("Masa Media Digital");
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(["echo"]);
    await client.close();
  });

  it("forwards tool calls", async () => {
    const client = await connect(url);
    const result = await client.callTool({ name: "echo", arguments: { text: "shalom" } });
    expect(result.content).toEqual([{ type: "text", text: "echo: shalom" }]);
    await client.close();
  });

  it("starts without the network and reports an unreachable site as a tool error", async () => {
    // A port that was just closed, so the connection is refused.
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const port = (closed.address() as { port: number }).port;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    const client = await connect(`http://127.0.0.1:${port}/mcp/`);
    const result = await client.callTool({ name: "echo", arguments: { text: "x" } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("Could not reach");
    expect(JSON.stringify(result.content)).toContain("ECONNREFUSED");
    await client.close();
  });
});
