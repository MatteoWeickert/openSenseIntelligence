# MCP Request Pipeline – openSenseIntelligence

## Overview

This document describes the complete lifecycle of a request to the openSenseIntelligence MCP server, from the moment an AI client sends an HTTP request until the final response is delivered back. The server implements the **Streamable HTTP** transport variant of the MCP specification in **stateless mode** (no persistent sessions).

---

## High-Level Flow

```
AI Client (ChatGPT/Claude/Copilot)
    │
    │  POST /mcp  (JSON-RPC 2.0)
    ▼
Express Server (server.ts)
    │
    │  app.use("/mcp", mcpRouter)
    ▼
MCP Router (mcp/router.ts)
    │
    │  Creates McpServer + StreamableHTTPServerTransport
    ▼
MCP Server (mcp/server.ts)
    │
    │  Dispatches to registered tool handler
    ▼
Tool Handler (mcp/tools/*.ts)
    │
    │  Validates input (Zod) → Fetches external data → Formats response
    ▼
External API (staging.opensensemap.org / archive.opensensemap.org)
    │
    │  JSON/CSV response
    ▼
Tool Handler
    │
    │  Returns {content: [{type: "text", text: "..."}]}
    ▼
MCP Server → Transport → HTTP Response → AI Client
```

---

## Detailed Step-by-Step

### Step 1: HTTP Request Arrives

The AI client sends a `POST` request to `https://<host>/mcp` with:

```http
POST /mcp HTTP/1.1
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": {},
    "clientInfo": {
      "name": "claude-desktop",
      "version": "1.0.0"
    }
  }
}
```

The MCP protocol uses JSON-RPC 2.0 as its wire format. The `method` field determines what operation is being performed.

---

### Step 2: Express Routing

The Express app routes the request:

```typescript
// server.ts
app.use("/mcp", mcpRouter);
```

The `mcpRouter` applies `express.json()` middleware to parse the body, then handles the POST:

```typescript
mcpRouter.post("/", async (req, res) => { ... });
```

---

### Step 3: Server & Transport Instantiation

For **every incoming request**, a fresh server instance is created:

```typescript
const server = createMcpServer();  // Registers all 8 tools
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,   // Stateless: no session tracking
});
```

**Why stateless?** Each request is self-contained. There is no session ID, no memory of previous requests. This makes the server horizontally scalable and simpler to deploy, but means the AI client must re-initialize on every request batch.

A cleanup handler ensures resources are freed when the connection closes:

```typescript
res.on("close", () => {
  transport.close();
  server.close();
});
```

---

### Step 4: Server-Transport Connection

The server connects to the transport, enabling message passing:

```typescript
await server.connect(transport);
```

This wires up the internal event handlers so that when the transport receives a JSON-RPC message, it routes it to the appropriate server method (initialize, tools/list, tools/call, etc.).

---

### Step 5: Request Delegation

The transport takes over HTTP handling:

```typescript
await transport.handleRequest(req, res, req.body);
```

The `StreamableHTTPServerTransport` parses the JSON-RPC envelope, validates the protocol version, and dispatches to the server's registered handlers.

---

### Step 6: MCP Protocol Messages

The AI client typically sends requests in this order during a conversation:

#### 6a: `initialize`

First message. The server responds with its capabilities and tool metadata:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": { "tools": {} },
    "serverInfo": {
      "name": "openSenseIntelligence",
      "version": "1.0.0"
    }
  }
}
```

#### 6b: `tools/list`

The client requests available tools. The server returns all 8 registered tools with their JSON Schema input definitions:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "search_boxes",
        "description": "Search for senseBox stations...",
        "inputSchema": {
          "type": "object",
          "properties": {
            "name": { "type": "string", "description": "..." },
            "near": { "type": "string", "description": "..." },
            ...
          }
        }
      },
      ...
    ]
  }
}
```

The AI client uses these schemas to decide which tool to call and how to format arguments.

#### 6c: `tools/call`

The client invokes a specific tool:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "search_boxes",
    "arguments": {
      "near": "51.96,7.63",
      "maxDistance": 5000,
      "exposure": "outdoor"
    }
  }
}
```

---

### Step 7: Tool Dispatch

The MCP server looks up the registered tool by name and invokes its handler function. The SDK automatically validates the `arguments` against the tool's Zod schema before calling the handler.

```typescript
// Inside mcp/tools/search-boxes.ts
server.registerTool(
  "search_boxes",
  { description: "...", inputSchema: { /* Zod schema */ } },
  async (params) => {
    // params is already validated and typed
    ...
  }
);
```

If validation fails, the SDK returns a JSON-RPC error response automatically.

---

### Step 8: Input Schema Validation (Zod)

Each tool defines its input with Zod schemas that are automatically converted to JSON Schema for the `tools/list` response:

```typescript
inputSchema: {
  name: z.string().optional().describe("Search by station name"),
  near: z.string().optional().describe("Comma-separated lat,lng"),
  maxDistance: z.number().optional().default(100000),
  exposure: z.enum(["indoor", "outdoor", "mobile", "unknown"]).optional(),
  ...
}
```

The Zod schema serves dual purpose:
1. **Client-facing:** Converted to JSON Schema for AI clients to understand parameters
2. **Server-facing:** Runtime validation + TypeScript type inference

---

### Step 9: External API Call

The tool handler calls external services via the library functions:

```typescript
// api-client.ts
const boxes = await osemFetch<BoxMinimal[]>({
  path: "/boxes",
  params: { minimal: true, near: "51.96,7.63", maxDistance: 5000, limit: 20 },
});
```

**`osemFetch()` internals:**
1. Constructs URL: `https://staging.opensensemap.org/api/boxes?minimal=true&near=51.96,7.63&...`
2. Creates `AbortController` with 15s timeout
3. Sends `fetch()` request
4. Checks response status (throws on non-OK)
5. Parses JSON body
6. Returns typed result

For archive tools, `archive-client.ts` is used instead, which has additional complexity:
- Constructs archive URLs: `https://archive.opensensemap.org/{date}/{boxId}-{name}/{sensorId}-{date}.csv`
- 3-level slug resolution fallback (ID match → name match → fuzzy skeleton)
- CSV parsing
- Batch fetching with concurrency control

---

### Step 10: Data Processing

After receiving raw data, the tool handler processes it:

**For `search_boxes` (proximity search):**
1. Calculate Haversine distance from query point to each box
2. Filter boxes exceeding `maxDistance`
3. Sort by distance ascending
4. Apply `limit` cap

**For `get_sensor_data`:**
1. Receive measurement array from API
2. Apply LTTB downsampling (max 50 points) via `downsample()`
3. Calculate statistics via `summarizeMeasurements()`:
   - count, min, max, mean, stddev
   - trend detection (first-third vs last-third average)

**For `export_data`:**
1. Fetch all measurements
2. Write to filesystem as CSV/JSON (`./mcp-exports/{id}.csv`)
3. Register in export registry (1h TTL)
4. Generate download URL

---

### Step 11: Response Formatting

Every tool returns a standardized MCP content response:

```typescript
return {
  content: [
    {
      type: "text" as const,
      text: "Found 3 station(s) within 5.0 km of [51.96, 7.63]:\n\n" +
            "• senseBox Münster (abc123) — outdoor, [51.95, 7.62], 1.2 km away\n" +
            "• Wetterstation Uni (def456) — outdoor, [51.97, 7.64], 2.1 km away\n" +
            "• Stadtwerke MS (ghi789) — outdoor, [51.94, 7.60], 4.8 km away"
    }
  ]
};
```

The response is always plain text (type `"text"`). The AI client interprets this text to formulate its answer to the user.

---

### Step 12: JSON-RPC Response

The MCP server wraps the tool result in a JSON-RPC response:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 3 station(s) within 5.0 km of [51.96, 7.63]:..."
      }
    ]
  }
}
```

---

### Step 13: HTTP Response

The `StreamableHTTPServerTransport` serializes the JSON-RPC response and sends it as the HTTP response body:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"..."}]}}
```

---

### Step 14: Cleanup

After the response is sent, the connection close handler fires:

```typescript
res.on("close", () => {
  transport.close();  // Closes the transport layer
  server.close();     // Destroys the server instance
});
```

All resources (server, transport, internal state) are garbage collected. Nothing persists between requests.

---

## Multi-Tool Conversations

In practice, an AI client typically makes **multiple sequential requests** to answer a single user question:

```
User: "What's the temperature in Münster right now?"

AI Client:
  1. POST /mcp → initialize
  2. POST /mcp → tools/list (get available tools)
  3. POST /mcp → tools/call search_boxes {near: "51.96,7.63", maxDistance: 5000}
     ← Returns list of boxes with IDs
  4. POST /mcp → tools/call get_box_info {boxId: "abc123def456..."}
     ← Returns sensors with IDs and last measurements
  5. POST /mcp → tools/call get_sensor_data {boxId: "...", sensorId: "..."}
     ← Returns time series + statistics

AI Client formulates final answer:
  "The current temperature in Münster is 22.3°C (measured at senseBox Münster,
   last updated 5 minutes ago). Over the last 24h: min 18.1°C, max 25.7°C,
   trend: rising."
```

Each of these is an independent HTTP request. The server has no memory of previous calls — the AI client maintains conversation context.

---

## Error Handling

Errors are returned as JSON-RPC error responses:

| Scenario | Response |
|----------|----------|
| Invalid JSON-RPC | `{"error": {"code": -32700, "message": "Parse error"}}` |
| Unknown method | `{"error": {"code": -32601, "message": "Method not found"}}` |
| Invalid tool params (Zod) | `{"error": {"code": -32602, "message": "Invalid params"}}` |
| External API timeout | Tool returns error text in content |
| External API 404 | Tool returns "not found" message in content |

Tool-level errors (API failures, no data) are generally returned as **text content** rather than protocol errors, so the AI client can explain the situation to the user.

---

## Timing Characteristics

| Phase | Typical Duration |
|-------|-----------------|
| Express routing + JSON parse | < 1 ms |
| Server/Transport instantiation | < 5 ms |
| Zod schema validation | < 1 ms |
| External API call (Staging) | 100–500 ms |
| External API call (Archive) | 200–2000 ms |
| Slug resolution fallback | 500–1500 ms (extra HTTP call) |
| Data processing (summarize/downsample) | < 10 ms |
| Response serialization | < 1 ms |
| **Total per tool call** | **~200–2500 ms** |

---

## Concurrency & Scaling

- **Stateless:** No shared state between requests → easy horizontal scaling
- **Per-request isolation:** Each request gets its own server instance → no race conditions
- **No connection pooling:** Each tool call creates new `fetch()` requests to external APIs
- **Export cleanup:** Background interval every 10 minutes removes expired files
- **Archive batch fetching:** Concurrent date fetching with configurable limit (default: 10 parallel)
